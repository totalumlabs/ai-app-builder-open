import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
    authFailed,
    enforceProjectScope,
    isRoutableProjectSlug,
    resolveVcaasContext,
} from "../../../vcaas/_shared";
import { vcaasRequest } from "@/lib/vcaas-server";
import { getPreviewUrl } from "@/lib/project-status";
import type { VcaasProject } from "@/lib/vcaas-types";
import { AGENT_PATH, AGENT_SOURCE, PREVIEW_RUNTIME_SHIM } from "@/lib/visual-edit-agent";
import { injectAgent, rewriteCss, rewriteHtml } from "@/lib/preview-proxy";

export const dynamic = "force-dynamic";

/**
 * ═══ THE SAME-ORIGIN PREVIEW PROXY (Feature F12) ════════════════════════════
 *
 * ⚠️⚠️ WHY THIS EXISTS — THE FINDING THAT DECIDED THE WHOLE FEATURE.
 *
 * A visual editor needs to read the DOM of the previewed app: hit-test a click,
 * outline an element, read its classes, change its text live. The preview is an
 * iframe on ANOTHER ORIGIN, so none of that is possible from the workspace.
 *
 * The obvious way out is the one the legacy Angular editor used: the generated
 * projects ship a `ScriptExecutor` component that accepts an `inject-editor-script`
 * `postMessage` and `new Function()`s it. **It does not work, and cannot.** Its very
 * first line is `if (process.env.NODE_ENV === 'production') return;`, Next.js inlines
 * that constant at build time, and the preview is served by `npm start` — a
 * PRODUCTION build. Verified, not assumed: a real `next build` of
 * `nextjs-startum-template` contains **zero** occurrences of `inject-editor-script`
 * anywhere in `.next` — the handler is dead-code-eliminated. The legacy editor's
 * injection is inert against every preview this platform shows.
 *
 * The alternative — writing an agent into the user's own project — would modify
 * their code and cost a 1-4 minute rebuild before the editor could be used at all.
 *
 * So the preview is proxied through OUR origin. Same origin ⇒ we own the document,
 * inject the agent into the HTML we serve, and nothing about the user's project
 * changes.
 *
 * ── THE SECURITY BOUNDARY ───────────────────────────────────────────────────
 *
 * 1. **Session first.** `resolveVcaasContext()` runs before anything else; an
 *    unauthenticated request never reaches upstream.
 * 2. **The upstream origin is RESOLVED SERVER-SIDE from the project**, via the
 *    caller's own VCaaS key — it is never taken from the request. There is no
 *    parameter here that names a URL, so this cannot be turned into an SSRF probe:
 *    the only reachable host is the preview of a project this session owns.
 * 3. **Ownership is upstream's answer.** `GET /projects/:id` with the user's key
 *    404s for a project they do not own, and we return 404 unchanged.
 * 4. **Only the resolved origin is fetched.** Redirects are followed manually and
 *    refused if they leave that origin.
 * 5. **The agent is served from our origin** and talks to the workspace over
 *    `postMessage` with an explicit same-origin check on both ends.
 * 6. **`set-cookie` is dropped.** The previewed app's cookies must not be written
 *    onto the platform's origin, where they would sit next to the session cookie.
 *
 * ⚠️ THE PROXY IS FOR EDITING, NOT FOR VIEWING. The normal preview iframe still
 * points straight at the sandbox; this route is used only while the visual editor is
 * open. That keeps the blast radius small and means a proxy failure degrades to
 * "the visual editor is unavailable", never to "the preview is broken".
 */

/** Hop-by-hop and identity headers that must not be forwarded either way. */
const STRIPPED_REQUEST_HEADERS = new Set([
    "host", "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade", "cookie", "origin", "referer",
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
    "connection", "keep-alive", "transfer-encoding", "upgrade", "content-encoding",
    "content-length", "set-cookie", "content-security-policy",
    "content-security-policy-report-only", "x-frame-options", "strict-transport-security",
]);

/**
 * ═══ THE RESOLVED ORIGIN, MEMOISED FOR A FEW SECONDS ════════════════════════
 *
 * ⚠️⚠️ WITHOUT THIS, ONE PAGE LOAD PAYS THE SAME EXPENSIVE QUESTION FIVE TIMES.
 * Every request through this proxy — the document AND each asset — called
 * `GET /projects/:id`, and that call is NOT cheap: on the account-backend it runs
 * `computeDevelopmentUrlRecommendation`, which probes the sandbox's HTML **twice**.
 * Against a sleeping sandbox each round trip is seconds, not milliseconds.
 *
 * ⭐ MEASURED, ON THE REPORTED PROJECT: raw upstream 3.2 s per request, but 7.9 s
 * through this proxy — 4.7 s of it this one call, repeated per asset. That turned
 * the broken-preview check (1 document + 4 probes, then a confirming pass) into a
 * **~42-second** wait before the user was told anything, which is
 * indistinguishable from "the feature does not work". It is what they reported.
 *
 * ⚠️ KEYED BY THE CALLER, NOT JUST THE PROJECT — this is a security property, not
 * a detail. The origin is resolved with the CALLER'S OWN key and ownership is
 * upstream's answer (a project you do not own 404s). A cache keyed on `projectId`
 * alone would let one user's successful resolution answer another user's request.
 * With `accountUserId` in the key, a non-owner always misses and always re-asks.
 *
 * ⚠️ THE TTL IS DELIBERATELY SHORTER THAN ANYTHING THAT CAN CHANGE THE ANSWER.
 * `getPreviewUrl`'s contract is that the field is re-read on navigation, on manual
 * refresh and whenever a run finishes — all of which take far longer than this. So
 * this can only ever collapse a BURST of requests that belong to one page load; it
 * cannot serve a stale origin across a rebuild.
 *
 * ⚠️ FAILURES ARE NEVER CACHED. A 404/409 stays a live question, so a project that
 * has just acquired a preview is not told "no preview" for another 15 seconds.
 */
const ORIGIN_TTL_MS = 15_000;
const originCache = new Map<string, { origin: string; at: number }>();

function cachedOrigin(key: string): string | null {
    const hit = originCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > ORIGIN_TTL_MS) {
        originCache.delete(key);
        return null;
    }
    return hit.origin;
}

function rememberOrigin(key: string, origin: string): void {
    /**
     * A bound so a long-lived server cannot accumulate an entry per project seen.
     * Well above any real fan-out; the oldest insertion goes first.
     */
    if (originCache.size > 500) {
        const oldest = originCache.keys().next().value;
        if (oldest !== undefined) originCache.delete(oldest);
    }
    originCache.set(key, { origin, at: Date.now() });
}

async function resolvePreviewOrigin(
    projectId: string,
    ctx: Parameters<typeof vcaasRequest>[2]
): Promise<{ origin: string } | { error: NextResponse }> {
    const cacheKey = `${ctx?.accountUserId ?? ""}:${projectId}`;
    const hit = cachedOrigin(cacheKey);
    if (hit) return { origin: hit };

    const response = await vcaasRequest(`/projects/${encodeURIComponent(projectId)}`, {}, ctx);
    const payload = (await response.json().catch(() => null)) as { data?: VcaasProject } | null;

    if (!response.ok || !payload?.data) {
        return { error: NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 }) };
    }

    const previewUrl = getPreviewUrl(payload.data);
    if (!previewUrl) {
        return {
            error: NextResponse.json(
                { ok: false, error: "This project has no preview yet", code: "NO_PREVIEW" },
                { status: 409 }
            ),
        };
    }

    try {
        const url = new URL(previewUrl);
        // http/https only — a `javascript:` or `file:` value upstream must not be followed.
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
        // Only a SUCCESSFUL resolution is remembered — see the note on the cache.
        rememberOrigin(cacheKey, url.origin);
        return { origin: url.origin };
    } catch {
        return { error: NextResponse.json({ ok: false, error: "Bad preview URL" }, { status: 502 }) };
    }
}

async function handle(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; path?: string[] }> }
) {
    const auth = await resolveVcaasContext();
    if (authFailed(auth)) return auth.response;

    const { projectId, path } = await params;
    if (!isRoutableProjectSlug(projectId)) {
        return NextResponse.json({ ok: false, error: "Invalid project" }, { status: 404 });
    }

    /**
     * ⚠️⚠️ THE MANAGER-SCOPE GATE, MISSING UNTIL NOW (finding #7). Control 3 in the
     * header above says "ownership is upstream's answer" — true for the ACCOUNT, but
     * every member presents the OWNER's key, so upstream cannot separate members
     * from each other. Without this a manager scoped to one project could proxy, and
     * therefore read, the running preview of every other project on the account.
     *
     * ⚠️ IT ASKS FOR `project.view` ON EVERY METHOD, deliberately — note the literal
     * `"GET"` rather than `request.method`. A POST through this proxy is somebody
     * USING the previewed app (submitting its forms), not editing the project, so
     * requiring `project.edit` for it would break the preview for a view-scoped
     * manager who is entitled to look at it. Viewing the project is the right
     * question, and it is the same one for every verb.
     *
     * ⚠️ IT RUNS BEFORE THE AGENT IS SERVED BELOW, so an out-of-scope caller cannot
     * fetch the injected editor agent for a project they may not open either.
     */
    const outOfScope = enforceProjectScope(auth.team, "GET", ["projects", projectId]);
    if (outOfScope) return outOfScope;

    /**
     * ⭐ THE AGENT IS SERVED BY US, NOT PROXIED. It never touches the user's
     * project, and because it comes from this origin the previewed document can be
     * scripted by the workspace at all. Session-gated like everything else here.
     */
    if ((path ?? []).length === 1 && path![0] === AGENT_PATH) {
        /**
         * ⭐ G3 — THE SHIM SHIPS AHEAD OF THE AGENT, IN ONE FILE.
         *
         * One file rather than two script tags because the ORDER is not negotiable:
         * the runtime URL shim must have patched `document.createElement` and `fetch`
         * before anything else executes (audit B1). Concatenation makes that ordering
         * structural instead of dependent on how the browser schedules two requests.
         */
        const base = `/api/preview/${encodeURIComponent(projectId)}`;
        const body = `${PREVIEW_RUNTIME_SHIM(base)}\n${AGENT_SOURCE}`;
        return new NextResponse(body, {
            status: 200,
            headers: {
                "content-type": "application/javascript; charset=utf-8",
                "cache-control": "no-store",
            },
        });
    }

    const resolved = await resolvePreviewOrigin(projectId, auth.ctx);
    if ("error" in resolved) return resolved.error;

    const suffix = (path ?? []).map(encodeURIComponent).join("/");
    const target = new URL(`${resolved.origin}/${suffix}`);
    target.search = request.nextUrl.search;

    // Forward the request, minus the headers that would confuse the upstream or
    // leak our own identity into it.
    const headers = new Headers();
    request.headers.forEach((value, key) => {
        if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
    });
    // Ask for an unencoded body so the HTML rewrite below does not have to gunzip.
    headers.set("accept-encoding", "identity");

    let upstream: Response;
    try {
        upstream = await fetch(target, {
            method: request.method,
            headers,
            body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
            redirect: "manual",
            cache: "no-store",
        });
    } catch {
        return NextResponse.json(
            { ok: false, error: "The preview server did not respond", code: "PREVIEW_UNREACHABLE" },
            { status: 502 }
        );
    }

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
        if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
    });

    const base = `/api/preview/${encodeURIComponent(projectId)}`;

    // ── Redirects stay inside the proxy, and inside the origin ──────────────
    const location = upstream.headers.get("location");
    if (location) {
        try {
            const next = new URL(location, target);
            if (next.origin !== resolved.origin) {
                // Leaving the preview origin ends the proxy's remit.
                return NextResponse.json({ ok: false, error: "Blocked cross-origin redirect" }, { status: 502 });
            }
            responseHeaders.set("location", `${base}${next.pathname}${next.search}`);
        } catch {
            responseHeaders.delete("location");
        }
        return new NextResponse(null, { status: upstream.status, headers: responseHeaders });
    }

    const contentType = upstream.headers.get("content-type") || "";

    // ── HTML: rewrite root-absolute URLs, then inject the agent ─────────────
    if (contentType.includes("text/html")) {
        const html = await upstream.text();
        const rewritten = injectAgent(rewriteHtml(html, base), base);
        responseHeaders.set("content-type", "text/html; charset=utf-8");
        responseHeaders.set("cache-control", "no-store");
        return new NextResponse(rewritten, { status: upstream.status, headers: responseHeaders });
    }

    // ── CSS: rewrite root-absolute url() so webfonts resolve (G3) ───────────
    if (contentType.includes("text/css")) {
        const css = await upstream.text();
        responseHeaders.set("content-type", contentType);
        return new NextResponse(rewriteCss(css, base), { status: upstream.status, headers: responseHeaders });
    }

    // Everything else (JS, images, JSON) is streamed through untouched.
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
