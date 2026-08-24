import { AGENT_SCRIPT_TAG } from "@/lib/visual-edit-agent";

/**
 * ═══ THE PREVIEW-PROXY REWRITES (Feature F12, hardened in G3) ═══════════════
 *
 * Pure string work, extracted from the route because **a Next.js route file may
 * only export HTTP methods** — exporting a helper from it fails the build with
 * "is not a valid Route export field". Which is a happy accident: here they are
 * unit-testable, and the HTML rewrite is exactly the kind of thing that needs tests.
 */

/**
 * Point root-absolute URLs at the proxy.
 *
 * ⚠️ ATTRIBUTE-SCOPED, NOT A BLIND STRING REPLACE. Rewriting every `"/` in the
 * document would corrupt inline JSON, script bodies and text content. Only
 * `src`/`href`/`action`/`srcset`/`content` values that start with a single `/` are
 * touched — `//cdn.example.com` is protocol-relative and must be left alone.
 *
 * Next.js also embeds `/_next/...` inside its bootstrap JSON payload, so those are
 * rewritten too; that is the one string form specific enough to be safe.
 *
 * ⚠️ G3 — THIS IS ONLY HALF THE JOB, AND THAT IS WHY THE PREVIEW USED TO BE BLANK.
 * It can only fix URLs that appear in the HTML. Next.js computes most of its chunk
 * URLs at RUNTIME from a `publicPath` inlined at build time, which no amount of HTML
 * rewriting can reach. The other half is `PREVIEW_RUNTIME_SHIM`, injected by
 * `injectAgent` below — see the long note on it in `visual-edit-agent.ts`.
 */
export function rewriteHtml(html: string, base: string): string {
    return html
        .replace(/(\s(?:src|href|action|poster)\s*=\s*")\/(?!\/)/g, `$1${base}/`)
        .replace(/(\s(?:src|href|action|poster)\s*=\s*')\/(?!\/)/g, `$1${base}/`)
        .replace(/(\ssrcset\s*=\s*")([^"]*)"/g, (_full, prefix: string, value: string) => {
            const next = value
                .split(",")
                .map(part => part.trim().replace(/^\/(?!\/)/, `${base}/`))
                .join(", ");
            return `${prefix}${next}"`;
        })
        .replace(/"\/_next\//g, `"${base}/_next/`);
}

/**
 * Put the editor bundle (runtime shim + agent) at the very TOP of `<head>`.
 *
 * ⚠️⚠️ G3 — THE POSITION IS LOAD-BEARING, NOT TIDINESS. It used to be injected before
 * `</head>`, i.e. AFTER the app's own `<script async>` tags. The runtime shim has to
 * patch `document.createElement` and `fetch` **before any application code runs**, or
 * the first chunk request escapes the proxy and 404s. First in `<head>` is the only
 * position that guarantees that.
 *
 * The fallbacks walk down in order of how much of the document we can see: an opening
 * `<head>`, then `<html>`, then `<body>`, then the front of whatever we were given.
 */
/**
 * Point root-absolute `url(...)` references in a stylesheet at the proxy.
 *
 * ⚠️ G3 — CSS IS A THIRD URL SPACE the HTML rewrite and the runtime shim both miss.
 * Next.js emits `url(/_next/static/media/….woff2)` inside its stylesheets; those are
 * resolved by the CSS engine, not by webpack and not by any DOM API we can patch, so
 * they 404ed at the platform root. Fonts failing is only cosmetic — the page falls
 * back — but it is four console errors on every preview and it is two lines to fix.
 *
 * Quoted, single-quoted and bare forms are all handled; `//host` and `data:` are left
 * alone.
 */
export function rewriteCss(css: string, base: string): string {
    return css.replace(
        /url\(\s*(['"]?)\/(?!\/)/g,
        (_full, quote: string) => `url(${quote}${base}/`
    );
}

export function injectAgent(html: string, base: string): string {
    const tag = AGENT_SCRIPT_TAG(base);

    const headOpen = /<head[^>]*>/i.exec(html);
    if (headOpen) {
        const at = headOpen.index + headOpen[0].length;
        return html.slice(0, at) + tag + html.slice(at);
    }

    const htmlOpen = /<html[^>]*>/i.exec(html);
    if (htmlOpen) {
        const at = htmlOpen.index + htmlOpen[0].length;
        return html.slice(0, at) + tag + html.slice(at);
    }

    const bodyOpen = /<body[^>]*>/i.exec(html);
    if (bodyOpen) {
        const at = bodyOpen.index + bodyOpen[0].length;
        return html.slice(0, at) + tag + html.slice(at);
    }

    return `${tag}${html}`;
}
