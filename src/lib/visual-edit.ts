/**
 * ═══ THE VISUAL EDITOR: MODEL AND MATCHER (Feature F12) ═════════════════════
 *
 * The pure half — no React, no fetch, no DOM. It answers one hard question:
 *
 *   **A user changed something in a rendered page. Which characters in which
 *   source file produced it?**
 *
 * ⚠️⚠️ THERE IS NO SOURCE MAP TO ASK. The preview is a PRODUCTION `next start`
 * build: no React DevTools source info, no `__source` props, no dev overlay. So the
 * mapping is reconstructed from SIGNALS — the text itself, the class attribute, the
 * siblings around it, the parent, the position among same-tag siblings, and the
 * route the user was on. Any one of them is weak; together they identify an
 * occurrence with enough confidence to edit it, and — just as importantly — to
 * REFUSE when they do not.
 *
 * ⭐ THE SCORING IS PORTED FROM THE LEGACY ANGULAR EDITOR
 * (`totalum-frontend/src/app/features/startum/services/visual-editor/`), which
 * solved this exact problem against these exact generated projects. Re-deriving it
 * would have meant re-learning its lessons in production. The weights below are its
 * weights; what is new here is that a low score REFUSES instead of guessing.
 *
 * Unit-tested by `src/lib/__tests__/visual-edit.test.ts`.
 */

// ─── What the agent tells us about the element ───────────────────────────────

/**
 * Everything the in-page agent can observe about a selected element. It is
 * deliberately all strings and numbers: it crosses a `postMessage` boundary, so it
 * must survive structured cloning and must never carry a DOM reference.
 */
export interface ElementSignature {
    /** The preview path when the element was selected, e.g. `/about`. */
    route: string;
    /** Lowercase tag name, e.g. `h1`. */
    tag: string;
    /** `textContent`, trimmed and collapsed. `null` when the element has children. */
    text: string | null;
    /**
     * The `class` attribute **as it exists in the source**.
     *
     * ⚠️ G3/B2 — THE EDITOR'S OWN CLASSES ARE STRIPPED BEFORE THIS IS REPORTED.
     * `select()` adds `totalum-ve-selected` to draw the outline, and this field used to
     * be read *after* that — so every style edit's `before` carried a class that exists
     * in no source file and every size/colour change resolved to `not-found`. See
     * `stripEditorClasses`.
     */
    className: string | null;
    parentTag: string | null;
    parentClassName: string | null;
    /** Trimmed text of the previous / next element sibling, for context scoring. */
    prevSiblingText: string | null;
    nextSiblingText: string | null;
    /** 1-based position among siblings of the same tag. */
    nthOfType: number;
    /**
     * `src` for images and videos, **with the preview-proxy prefix removed**.
     *
     * ⚠️ G3/B3 — the proxy rewrites `src="/hero.png"` to
     * `src="/api/preview/<id>/hero.png"` before the agent ever sees the DOM, so this
     * used to report a string that appears in no source file. See `stripProxyBase`.
     */
    src: string | null;
    /** A short human label for the breadcrumb, e.g. `section > h1.hero-title`. */
    breadcrumb: string;

    // ── G3 additions ────────────────────────────────────────────────────────

    /**
     * ⭐ THE STRONGEST SIGNAL WE CAN GET WITHOUT A BUILD PLUGIN.
     *
     * An `id` is near-unique inside a file and survives reformatting, class churn and
     * text edits — exactly what the text/class/sibling signals do not. The real
     * generated projects use them liberally (`id="hero-heading"`), so this is not a
     * theoretical improvement. `null` when the element has none.
     */
    id: string | null;

    /** The nearest ancestor `id`, for elements that have none of their own. */
    ancestorId: string | null;

    /**
     * ⭐ A STABLE HANDLE FOR *THIS* SELECTION, minted by the agent and bumped on every
     * `select()`. It identifies the element across re-describes, which is what lets the
     * store collapse consecutive edits to one property (G3/M4). It is deliberately NOT
     * derived from the class attribute — the old code keyed on the breadcrumb, which
     * changes the moment a size or colour edit rewrites the first class.
     */
    selectionId: string;

    // ── G5 additions ────────────────────────────────────────────────────────
    //
    // ⚠️ EVERY ONE OF THESE IS OPTIONAL, AND THAT IS NOT LAZINESS. The agent is served
    // into a previewed app that may have been built weeks ago and is still running; a
    // signature from an older agent must keep resolving rather than crashing the batch.
    // The matcher treats each as evidence when present and ignores it when absent.

    /**
     * ⭐⭐⭐ `"src/app/page.tsx:42:7"` — WHERE THIS ELEMENT WAS WRITTEN, ACCORDING TO
     * THE BUILD ITSELF.
     *
     * Stamped by the template's `data-tlm-loc` webpack loader. When it is present there
     * is no matching problem left to solve: merged `cn()` classes, `${font.className}`
     * interpolation, repeated cards, `.map()`, HTML entities and component indirection
     * all stop mattering, because the element is NAMED rather than described. Absent on
     * projects built before the loader shipped — hence tiers 2 and 3.
     */
    loc?: string | null;
    /** The nearest tagged ancestors, innermost first. Locates the region when `loc` is absent. */
    ancestorLocs?: string[];

    /** The class attribute split into tokens, so the matcher never re-splits a string. */
    classTokens?: string[];
    /** `textContent` of the whole subtree — set even when `text` is null. */
    subtreeText?: string | null;
    /** `alt`, `href`, `placeholder`, `title`, `aria-label`, `type`, `name`. */
    attrs?: Record<string, string>;
    /**
     * The ancestor chain up to `<body>`, innermost first. Separates two identical cards
     * that live in different sections — the single most common ambiguity on a landing page.
     */
    path?: { tag: string; id: string | null; tokens: string[]; nthOfType: number }[];
    /**
     * ⭐ WHICH OF THE IDENTICAL ONES. `domOrdinal` is this element's position among the
     * `domTwins` elements on the page that look exactly like it. When the source has the
     * same number of indistinguishable candidates, the two sets are the same set and the
     * ordinal picks the right one — turning the commonest `ambiguous` into an answer.
     */
    domOrdinal?: number;
    domTwins?: number;
}

export type VisualChangeKind = "text" | "class" | "src";

// ─── Sanitisers shared by the agent and the server (G3: B2 + B3) ─────────────

/**
 * The prefix every class the editor adds to someone else's DOM must carry.
 *
 * ⚠️ ONE PREFIX, ONE STRIP FUNCTION. The outline classes are the only thing the editor
 * writes into the previewed document, and B2 proved that letting even one of them reach
 * a `VisualChange.before` silently breaks a whole edit kind.
 */
export const EDITOR_CLASS_PREFIX = "totalum-ve-";

/**
 * Remove the editor's own classes from a class attribute.
 *
 * Returns `null` for an element that had no classes of its own, so the caller can tell
 * "no class attribute in the source" apart from "an empty one" — they resolve
 * differently.
 */
export function stripEditorClasses(className: string | null | undefined): string | null {
    if (!className) return null;
    const kept = className
        .split(/\s+/)
        .filter(token => token && !token.startsWith(EDITOR_CLASS_PREFIX));
    return kept.length > 0 ? kept.join(" ") : null;
}

/**
 * Undo the preview proxy's URL rewrite so a `src` matches the source again.
 *
 * `/api/preview/my-app/hero.png` → `/hero.png`. Anything that is not under this
 * project's proxy base is returned untouched — an absolute `https://…` src is already
 * what the source says.
 */
export function stripProxyBase(value: string | null | undefined, base: string | null | undefined): string | null {
    if (!value) return null;
    if (!base) return value;
    const clean = base.replace(/\/+$/, "");
    if (!clean) return value;
    if (value === clean) return "/";
    return value.startsWith(`${clean}/`) ? value.slice(clean.length) : value;
}

export interface VisualChange {
    id: string;
    kind: VisualChangeKind;
    signature: ElementSignature;
    /** The value as it exists in the source today. */
    before: string;
    /** The value the user wants. */
    after: string;
    /**
     * ⭐⭐ G6 — `after` IS A URL WE JUST MINTED, NOT ONE THE USER CHOSE.
     *
     * ⚠️⚠️ ONLY SET BY THE UPLOAD DROPZONE, AND THE DISTINCTION IS THE WHOLE POINT.
     * Dropping a file on the panel uploads it to Totalum storage and yields a **signed
     * `storage.googleapis.com` URL**. Writing that into someone's source is wrong twice
     * over: their app now depends on our storage forever, and — because the template
     * only allows `placeholders.io` in `images.remotePatterns` — a `next/image` pointed
     * at it throws at runtime and takes the route down. So an uploaded url is copied
     * INTO the project (`public/uploads/…`) before anything is resolved, and the source
     * gets a root-relative path a developer would have written themselves.
     *
     * A url the user TYPED or pasted is left exactly as they wrote it: that is an
     * explicit choice about where their image lives, and moving it would be a surprise.
     */
    uploaded?: boolean;
}

// ─── Route → file ────────────────────────────────────────────────────────────

/**
 * Files that could plausibly render a given route, best first.
 *
 * ⚠️ IT RETURNS CANDIDATES, NOT AN ANSWER. A route is rendered by a page, but the
 * text on screen may live in a component the page imports, or in the layout. So the
 * route contributes a SCORE (below) rather than filtering the search — filtering
 * would make every edit to a shared component impossible.
 */
export function routeToPageFiles(route: string): string[] {
    const clean = (route || "/").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
    const segments = clean === "/" ? [] : clean.slice(1).split("/");
    const base = ["src/app", "app"];

    const files: string[] = [];
    for (const root of base) {
        const dir = segments.length === 0 ? root : `${root}/${segments.join("/")}`;
        files.push(`${dir}/page.tsx`, `${dir}/page.jsx`);
    }
    return files;
}

/**
 * How well a file path matches a route.
 *
 * `30` exact page · `25` dynamic segment (`[id]`) · `15` shares a segment name ·
 * `5` a layout for that branch · `0` otherwise.
 */
export function scoreRouteMatch(filePath: string, route: string): number {
    const clean = (route || "/").split("?")[0].replace(/\/+$/, "") || "/";
    const segments = clean === "/" ? [] : clean.slice(1).split("/");

    if (routeToPageFiles(route).includes(filePath)) return 30;

    const isPage = /\/page\.[jt]sx$/.test(filePath);
    const isLayout = /\/layout\.[jt]sx$/.test(filePath);

    // Dynamic route: `src/app/products/[id]/page.tsx` for `/products/123`.
    if (isPage) {
        const fileSegments = filePath
            .replace(/^(src\/)?app\//, "")
            .replace(/\/page\.[jt]sx$/, "")
            .split("/")
            .filter(Boolean)
            // Route groups `(marketing)` do not appear in the URL.
            .filter(segment => !segment.startsWith("("));

        if (fileSegments.length === segments.length) {
            const matches = fileSegments.every(
                (segment, index) => segment === segments[index] || /^\[.+\]$/.test(segment)
            );
            if (matches) return 25;
        }
    }

    if (segments.length > 0 && segments.some(segment => filePath.includes(`/${segment}`))) {
        return isLayout ? 5 : 15;
    }

    return isLayout ? 5 : 0;
}

// ─── Candidate search ────────────────────────────────────────────────────────

export interface Candidate {
    filePath: string;
    /** Index in the file of the value to replace. */
    index: number;
    /** The exact substring at `index` that will be replaced. */
    match: string;
    score: number;
    reasons: string[];
    /**
     * What to write in `match`'s place, when it is NOT simply the change's `after`.
     *
     * ⚠️ G4 — ONLY THE TEMPLATE-LITERAL CLASS PATH SETS THIS. There, the value in the
     * source is not the value in the DOM: the source holds static tokens plus
     * `${…}` interpolations, and the DOM holds those statics plus whatever the
     * interpolations evaluated to. Writing the DOM string back would hard-code a
     * next/font hash into someone's source. See `findTemplateClassCandidates`.
     */
    replacement?: string;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Everything a scorer needs from the file, computed once per candidate. */
function contextAround(content: string, index: number, radius = 400): string {
    return content.slice(Math.max(0, index - radius), index + radius);
}

/**
 * ⭐⭐ THE SIGNAL WEIGHTS. Ported from the legacy editor, with one addition: a
 * candidate that scores below `MIN_CONFIDENCE` is REFUSED rather than applied with a
 * warning nobody reads. Silently editing the wrong line of someone's app is worse
 * than telling them we could not place the change — which is exactly what the brief
 * asks for.
 */
export const WEIGHTS = {
    route: 30,
    sibling: 30,
    className: 25,
    parent: 20,
    nthOfType: 15,
    /**
     * ⭐ G3 — THE ID IS WORTH MORE THAN EVERYTHING ELSE COMBINED, on purpose.
     *
     * `id="hero-heading"` appearing within 400 characters of the candidate is as close
     * to proof as this approach gets: ids are near-unique per file and, unlike text,
     * classes and siblings, they survive exactly the edits this tool makes. A candidate
     * with the right id should win outright even when every other signal is silent,
     * which is the common shape for a deeply-nested element in a generated project.
     */
    id: 60,
    /** The nearest ancestor's id — weaker, but it still pins the region of the file. */
    ancestorId: 20,
} as const;

/** At or above this, apply. Below it, report the change as unmapped. */
export const MIN_CONFIDENCE = 45;
/** At or above this, no warning at all. Between the two, apply and flag. */
export const HIGH_CONFIDENCE = 80;

function scoreCandidate(
    filePath: string,
    content: string,
    index: number,
    signature: ElementSignature
): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    const routeScore = scoreRouteMatch(filePath, signature.route);
    if (routeScore > 0) {
        score += routeScore;
        reasons.push(`route+${routeScore}`);
    }

    const near = contextAround(content, index);

    /**
     * ⭐ THE ID, FIRST AND HEAVIEST (G3). Matched as a literal `id="…"` attribute rather
     * than as a bare string, so a component whose *text* happens to contain the word
     * cannot claim it.
     */
    if (signature.id) {
        const idAttr = new RegExp(`\\bid\\s*=\\s*["']${escapeRegExp(signature.id)}["']`);
        if (idAttr.test(near)) {
            score += WEIGHTS.id;
            reasons.push("id");
        }
    } else if (signature.ancestorId) {
        const idAttr = new RegExp(`\\bid\\s*=\\s*["']${escapeRegExp(signature.ancestorId)}["']`);
        if (idAttr.test(near)) {
            score += WEIGHTS.ancestorId;
            reasons.push("ancestorId");
        }
    }

    // Siblings are the strongest single signal: they pin the element inside its
    // parent even when the same text appears many times in the file.
    const siblingHit =
        (signature.prevSiblingText && near.includes(signature.prevSiblingText)) ||
        (signature.nextSiblingText && near.includes(signature.nextSiblingText));
    if (siblingHit) {
        score += WEIGHTS.sibling;
        reasons.push("sibling");
    }

    if (signature.className && near.includes(signature.className)) {
        score += WEIGHTS.className;
        reasons.push("className");
    }

    if (signature.parentClassName && near.includes(signature.parentClassName)) {
        score += WEIGHTS.parent;
        reasons.push("parent");
    }

    /**
     * Position among same-tag elements, counted in the source up to this point.
     *
     * ⚠️ THE ELEMENT'S OWN OPENING TAG IS IN THAT COUNT. The index we score points
     * at the TEXT, which sits after `<h1 …>`, so the first `<h1>` in a file already
     * counts as one. Comparing `occurrences + 1` (the obvious version) meant this
     * signal never fired at all — a unit test caught it, and it had been quietly
     * costing every match 15 points.
     *
     * ⚠️ IT IS A HEURISTIC, WORTH 15 OF 120. The agent's `nthOfType` is scoped to
     * SIBLINGS while this count is scoped to the FILE; they agree when a page's
     * same-tag elements are siblings, which is the common case, and when they do not
     * agree the other four signals still decide.
     */
    if (signature.tag) {
        const before = content.slice(0, index);
        const occurrences = before.split(new RegExp(`<${escapeRegExp(signature.tag)}[\\s>]`, "g")).length - 1;
        if (occurrences === signature.nthOfType) {
            score += WEIGHTS.nthOfType;
            reasons.push("position");
        }
    }

    return { score, reasons };
}

/**
 * Find where a TEXT change lives.
 *
 * ⚠️ ONLY BETWEEN JSX TAGS — `>text<`. Matching the bare string would happily
 * rewrite `const greeting = "Hello"` or a comment, i.e. break code the user never
 * saw. The legacy editor learned this and so does this one.
 */
export function findTextCandidates(
    files: Map<string, string>,
    change: VisualChange
): Candidate[] {
    const candidates: Candidate[] = [];
    const needle = change.before.trim();
    if (!needle) return candidates;

    const pattern = new RegExp(`>(\\s*)${escapeRegExp(needle)}(\\s*)<`, "g");

    for (const [filePath, content] of files) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
            // The replaceable span is the text itself, not the surrounding tags.
            const index = match.index + 1 + match[1].length;
            const { score, reasons } = scoreCandidate(filePath, content, index, change.signature);
            candidates.push({ filePath, index, match: needle, score, reasons });
        }
    }

    return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Find where a CLASS change lives — colour and text size are class edits.
 *
 * The literal class attribute is searched, so a `className={cn("a", b)}` call is
 * found only when the rendered string appears verbatim. When it does not, the change
 * is reported as unmapped instead of guessed at.
 */
export function findClassCandidates(
    files: Map<string, string>,
    change: VisualChange
): Candidate[] {
    const candidates: Candidate[] = [];
    const needle = change.before.trim();
    if (!needle) return candidates;

    // `className="…"` or `class="…"`, single or double quoted.
    const pattern = new RegExp(`(class(?:Name)?\\s*=\\s*["'])${escapeRegExp(needle)}(["'])`, "g");

    for (const [filePath, content] of files) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
            const index = match.index + match[1].length;
            const { score, reasons } = scoreCandidate(filePath, content, index, change.signature);
            candidates.push({ filePath, index, match: needle, score, reasons });
        }
    }

    return candidates.sort((a, b) => b.score - a.score);
}

/**
 * ═══ CLASS NAMES WRITTEN AS TEMPLATE LITERALS (G4) ══════════════════════════
 *
 * ⚠️⚠️ THIS IS NOT AN EDGE CASE — IT IS THE HEADINGS. Verified on a brand-new project
 * generated from a prompt: `src/app/page.tsx` had 21 plain `className="…"` attributes
 * and 6 of this shape —
 *
 *     className={`text-5xl md:text-7xl tracking-tight text-stone-900 ${fraunces.className}`}
 *
 * — and those 6 were the h1, the h2s, the h3s and the wordmark. Every element a user
 * reaches for first. `findClassCandidates` matches a QUOTED attribute value, so all six
 * came back "we couldn't find that exact text in the source" and the whole feature was
 * useless on the elements that matter most.
 *
 * Two things have to be true at once for this to be safe:
 *
 *  1. THE SOURCE AND THE DOM DO NOT AGREE, and the source is right. The DOM carries
 *     `__className_0d86af` — what `${fraunces.className}` evaluated to. Writing the DOM
 *     string back would bake a build-hash into someone's source and delete their font.
 *     So only the STATIC text is rewritten, and the interpolations are not touched.
 *
 *  2. WE MUST STILL BE ABLE TO PROVE THE MATCH. Whole-string equality is gone, so
 *     containment replaces it: every static token must be present in the rendered
 *     class list, and the rendered list may hold only a few tokens the source does not
 *     explain (those the interpolations produced). A literal that fails either test is
 *     not a candidate at all — it does not get a low score, it gets no vote.
 */
interface StaticClassSegment {
    /** Absolute index in the file of the static run we may edit. */
    index: number;
    /** The exact text at `index`. */
    text: string;
    tokens: string[];
}

/**
 * Locate `className={`…`}` literals and, for each, the ONE static run inside it.
 *
 * ⚠️ EXACTLY ONE non-empty static run is required. `` `${a} p-4 ${b}` `` qualifies —
 * there is one place to put the answer. `` `p-4 ${a} m-2` `` does not: the tokens would
 * have to be split across two runs and any rule for doing that is a guess about
 * someone's formatting. Refusing is the cheaper mistake, and this shape is rare.
 */
export function findStaticClassSegments(content: string): StaticClassSegment[] {
    const out: StaticClassSegment[] = [];
    const opener = /class(?:Name)?\s*=\s*\{\s*`/g;
    let open: RegExpExecArray | null;

    while ((open = opener.exec(content)) !== null) {
        const bodyStart = open.index + open[0].length;

        // Walk to the closing backtick, stepping over `${ … }` (which can nest, and can
        // itself contain a backtick — so depth counting, not a regex).
        let i = bodyStart;
        let depth = 0;
        let end = -1;
        const spans: { start: number; end: number }[] = []; // the interpolations
        while (i < content.length) {
            const ch = content[i];
            if (ch === "\\") { i += 2; continue; }
            if (depth === 0 && ch === "`") { end = i; break; }
            if (ch === "$" && content[i + 1] === "{") {
                if (depth === 0) spans.push({ start: i, end: -1 });
                depth++;
                i += 2;
                continue;
            }
            if (depth > 0 && ch === "}") {
                depth--;
                if (depth === 0) spans[spans.length - 1].end = i + 1;
            }
            i++;
        }
        if (end === -1) continue; // unterminated — not our business
        opener.lastIndex = end + 1;

        // The static runs are everything between the interpolations.
        const runs: { start: number; end: number }[] = [];
        let cursor = bodyStart;
        for (const span of spans) {
            if (span.end === -1) { cursor = -1; break; }
            if (span.start > cursor) runs.push({ start: cursor, end: span.start });
            cursor = span.end;
        }
        if (cursor === -1) continue;
        if (end > cursor) runs.push({ start: cursor, end });

        const withTokens = runs
            .map(run => ({ run, tokens: content.slice(run.start, run.end).split(/\s+/).filter(Boolean) }))
            .filter(entry => entry.tokens.length > 0);

        if (withTokens.length !== 1) continue;

        const { run, tokens } = withTokens[0];
        out.push({ index: run.start, text: content.slice(run.start, run.end), tokens });
    }

    return out;
}

/**
 * The static text this segment should hold after the change, or `null` to refuse.
 *
 * ⚠️ THE INTERPOLATED TOKENS ARE DERIVED, NOT ASSUMED: they are exactly the rendered
 * tokens the source does not account for. Carrying them forward — rather than writing
 * the rendered list — is what stops `${fraunces.className}` being replaced by the hash
 * it happened to produce on this build.
 */
export function rewriteStaticClassSegment(
    segment: StaticClassSegment,
    change: VisualChange
): string | null {
    const rendered = change.before.split(/\s+/).filter(Boolean);
    const renderedAfter = change.after.split(/\s+/).filter(Boolean);

    // Containment: the source must explain itself against what was rendered.
    if (!segment.tokens.every(token => rendered.includes(token))) return null;

    const interpolated = rendered.filter(token => !segment.tokens.includes(token));
    /**
     * A handful at most. More than that and the literal is not this element — some
     * other element's shorter class list happens to be a subset of it, and a subset
     * match is not a match.
     */
    if (interpolated.length > MAX_INTERPOLATED_TOKENS) return null;

    const next = renderedAfter.filter(token => !interpolated.includes(token));
    if (!next.length) return null;

    // Keep the run's own surrounding whitespace: it is someone's line wrapping.
    const leading = /^\s*/.exec(segment.text)![0];
    const trailing = /\s*$/.exec(segment.text)![0];
    const rewritten = `${leading}${next.join(" ")}${trailing}`;
    return rewritten === segment.text ? null : rewritten;
}

const MAX_INTERPOLATED_TOKENS = 4;

/** Class edits where the source writes the list as a template literal. */
export function findTemplateClassCandidates(
    files: Map<string, string>,
    change: VisualChange
): Candidate[] {
    const candidates: Candidate[] = [];
    if (!change.before.trim()) return candidates;

    for (const [filePath, content] of files) {
        for (const segment of findStaticClassSegments(content)) {
            const replacement = rewriteStaticClassSegment(segment, change);
            if (replacement === null) continue;
            const { score, reasons } = scoreCandidate(filePath, content, segment.index, change.signature);
            candidates.push({
                filePath,
                index: segment.index,
                match: segment.text,
                score,
                reasons: [...reasons, "template"],
                replacement,
            });
        }
    }

    return candidates.sort((a, b) => b.score - a.score);
}

/** Find where an image/video `src` lives. Quoted attribute values only. */
export function findSrcCandidates(
    files: Map<string, string>,
    change: VisualChange
): Candidate[] {
    const candidates: Candidate[] = [];
    const needle = change.before.trim();
    if (!needle) return candidates;

    const pattern = new RegExp(`(["'])${escapeRegExp(needle)}(["'])`, "g");

    for (const [filePath, content] of files) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
            const index = match.index + 1;
            const { score, reasons } = scoreCandidate(filePath, content, index, change.signature);
            candidates.push({ filePath, index, match: needle, score, reasons });
        }
    }

    return candidates.sort((a, b) => b.score - a.score);
}

export function findCandidates(files: Map<string, string>, change: VisualChange): Candidate[] {
    if (change.kind === "text") return findTextCandidates(files, change);
    if (change.kind === "class") {
        /**
         * ⚠️ G4 — THE QUOTED FORM WINS WHENEVER IT EXISTS. It is an exact whole-value
         * match; the template form is a containment match and therefore weaker
         * evidence, so it is only consulted when the exact one found nothing. Merging
         * the two pools would let a containment hit sit within `AMBIGUITY_MARGIN` of an
         * exact one and turn a certain edit into a refusal.
         */
        const exact = findClassCandidates(files, change);
        return exact.length ? exact : findTemplateClassCandidates(files, change);
    }
    return findSrcCandidates(files, change);
}

// ─── Resolution ──────────────────────────────────────────────────────────────

export interface ResolvedEdit {
    changeId: string;
    /**
     * ⭐ G5 — EVERY CHANGE THIS ONE EDIT SATISFIES.
     *
     * Consecutive edits to one element's class attribute are COMPOSED into a single
     * write (recolour then resize is two changes and one attribute), so the edit that
     * lands has to clear all of them from the unsaved-changes bar. Absent on edits from
     * the legacy tier, where one change is always one edit.
     */
    changeIds?: string[];
    filePath: string;
    index: number;
    before: string;
    after: string;
    score: number;
    reasons: string[];
    /** `true` when the score cleared `HIGH_CONFIDENCE`. */
    confident: boolean;
}

export interface UnmappedChange {
    changeId: string;
    /**
     * Why we refused — surfaced to the user verbatim, via i18n keys.
     *
     * ⭐ G6 — `unsupported` IS THE HONEST ONE, AND IT IS NEW. It means "we know exactly
     * which element you clicked and we cannot express this edit in the source" — an
     * image whose url is computed, a static import, a value that only exists at
     * runtime. Before it existed, those changes were handed to the legacy text matcher
     * instead, which searched the raw file for the old value and wrote wherever it
     * happened to find it. The refusal is the feature.
     */
    reason: "not-found" | "ambiguous" | "low-confidence" | "overlapping" | "unsupported";
    /** How many places the value was found, for the "ambiguous" message. */
    occurrences: number;
}

export interface ResolutionResult {
    edits: ResolvedEdit[];
    unmapped: UnmappedChange[];
    /**
     * ⭐ Changes the source ALREADY satisfies — nothing to write, and nothing wrong.
     *
     * ⚠️ THESE ARE A SUCCESS, NOT A FAILURE, and treating them as `not-found` was a
     * real bug. See the note on the rescue in `resolveChanges`.
     */
    satisfied: string[];
}

/**
 * ⭐ RESOLVE A BATCH, AND REFUSE THE ONES IT CANNOT PLACE.
 *
 * ⚠️ AMBIGUITY IS A REFUSAL, NOT A COIN TOSS. When the best two candidates score
 * within `AMBIGUITY_MARGIN` of each other, there is no evidence to prefer one — so
 * the change is reported back to the user rather than applied to a guess.
 */
export const AMBIGUITY_MARGIN = 10;

export function resolveChanges(
    files: Map<string, string>,
    changes: VisualChange[]
): ResolutionResult {
    const edits: ResolvedEdit[] = [];
    const unmapped: UnmappedChange[] = [];
    const satisfied: string[] = [];

    for (const change of changes) {
        const candidates = findCandidates(files, change);

        if (candidates.length === 0) {
            /**
             * ⭐⭐ THE RESCUE: IS THE FILE ALREADY WHAT THE USER ASKED FOR?
             *
             * ⚠️ THIS FIXES A REPORTED FAILURE WHERE FOUR CHANGES CAME BACK
             * `not-found` WHILE THE USER WAS LOOKING AT THEM ON SCREEN.
             *
             * A change carries the value as it was BEFORE the edit. If the source
             * has since moved past it — the editor collapsed only consecutive edits,
             * so editing A, then B, then A again produced a change whose `before` is
             * A's intermediate value and exists nowhere; or a rebuild landed between
             * edits; or the agent rewrote the file — then `before` cannot be found
             * and the change was declared unmappable.
             *
             * But the question that matters is not "can I find the old value", it is
             * "does the file say what the user wants". So when `before` is missing
             * and `after` IS present and unambiguous, there is nothing to write and
             * nothing to report: the change is SATISFIED. The bar clears it, the user
             * sees the edit they made, and no file is touched.
             *
             * ⚠️⚠️ IT DEMANDS `HIGH_CONFIDENCE`, NOT `MIN_CONFIDENCE`, AND THAT IS THE
             * GUARD AGAINST THE ONE WAY THIS COULD DO HARM.
             *
             * Consider two headings, one of which is ALREADY `text-5xl`. The user
             * makes the other one `text-5xl` with a stale `before`. Searching for
             * the new value finds the first heading — a different element — and a
             * lenient rescue would call the change satisfied, clear it from the bar,
             * and never write it. The user's edit would vanish silently, which is
             * strictly worse than an honest `not-found`.
             *
             * `HIGH_CONFIDENCE` requires the route, the className, the parent and
             * the position all to agree, so the match has to be the user's actual
             * element rather than a lookalike. Ambiguity is refused on top of that.
             * When in doubt this falls through to `not-found` — the honest answer.
             */
            const already = findCandidates(files, { ...change, before: change.after });
            const [bestAlready, secondAlready] = already;

            if (
                bestAlready &&
                bestAlready.score >= HIGH_CONFIDENCE &&
                !(secondAlready && bestAlready.score - secondAlready.score < AMBIGUITY_MARGIN)
            ) {
                satisfied.push(change.id);
                continue;
            }

            unmapped.push({ changeId: change.id, reason: "not-found", occurrences: 0 });
            continue;
        }

        const [best, second] = candidates;

        if (best.score < MIN_CONFIDENCE) {
            unmapped.push({
                changeId: change.id,
                reason: candidates.length > 1 ? "ambiguous" : "low-confidence",
                occurrences: candidates.length,
            });
            continue;
        }

        if (second && best.score - second.score < AMBIGUITY_MARGIN) {
            unmapped.push({ changeId: change.id, reason: "ambiguous", occurrences: candidates.length });
            continue;
        }

        /**
         * ⚠️⚠️ TWO EDITS MUST NOT OVERLAP, AND THIS IS WHERE THAT IS DECIDED.
         *
         * Overlapping spans were previously discovered by `applyEdits`, which
         * silently dropped the loser — and the silence is what turned a survivable
         * conflict into a whole-batch `UNSAFE_WRITE`. Catching it here means the
         * conflict is reported as an ordinary unmappable change, with a reason, and
         * everything else in the batch still lands.
         *
         * The FIRST change wins, because the batch is ordered oldest-first and the
         * user's earlier intent is the one the later edit was made on top of.
         */
        const spanStart = best.index;
        const spanEnd = best.index + best.match.length;
        const overlapping = edits.some(
            existing =>
                existing.filePath === best.filePath &&
                spanStart < existing.index + existing.before.length &&
                existing.index < spanEnd
        );

        if (overlapping) {
            unmapped.push({ changeId: change.id, reason: "overlapping", occurrences: 1 });
            continue;
        }

        edits.push({
            changeId: change.id,
            filePath: best.filePath,
            index: best.index,
            before: best.match,
            after: best.replacement ?? change.after,
            score: best.score,
            reasons: best.reasons,
            confident: best.score >= HIGH_CONFIDENCE,
        });
    }

    return { edits, unmapped, satisfied };
}

export interface ApplyResult {
    /** Only the files whose contents actually changed. */
    files: Map<string, string>;
    /** The edits that were written. **Verify against THESE, never against the input.** */
    applied: ResolvedEdit[];
    /** Edits that could not be written because another edit had already moved the text. */
    skipped: ResolvedEdit[];
}

/**
 * Apply resolved edits to file contents.
 *
 * ⚠️⚠️ EDITS ARE APPLIED FROM THE END OF EACH FILE BACKWARDS. Two changes in one
 * file shift each other's indices the moment the first is written; going
 * back-to-front means every index is still valid when it is used. (The legacy
 * editor's batch service documents this as the bug that made multi-edit saves
 * corrupt files.)
 *
 * ⚠️⚠️ IT REPORTS WHAT IT APPLIED, AND THAT RETURN VALUE IS THE FIX FOR A REAL
 * `UNSAFE_WRITE`. This used to return only the new contents, and the defensive
 * `continue` below — which drops an edit whose text another edit has already
 * rewritten — was therefore SILENT. The route then handed `verifyEdits` every edit
 * for the file, including the dropped one, and was told (correctly) that it "is not
 * at the index we wrote it to". It read that as corruption and refused the whole
 * file, so two overlapping changes lost an entire batch of good ones:
 *
 *     { code: "UNSAFE_WRITE",
 *       unsafeWrites: [{ path: "src/app/page.tsx",
 *                        reason: "edit ve-…2fpeej is not at the index we wrote it to" }] }
 *
 * The safety net was not wrong to fire — it was asked the wrong question. Callers
 * must verify against `applied` and report `skipped` as unapplied changes.
 */
export function applyEdits(files: Map<string, string>, edits: ResolvedEdit[]): ApplyResult {
    const byFile = new Map<string, ResolvedEdit[]>();
    for (const edit of edits) {
        (byFile.get(edit.filePath) ?? byFile.set(edit.filePath, []).get(edit.filePath)!).push(edit);
    }

    const result: ApplyResult = { files: new Map(), applied: [], skipped: [] };

    for (const [filePath, fileEdits] of byFile) {
        const original = files.get(filePath);
        if (original === undefined) {
            // The file was never read — nothing here can be written.
            result.skipped.push(...fileEdits);
            continue;
        }

        let content = original;
        const ordered = [...fileEdits].sort((a, b) => b.index - a.index);
        const appliedHere: ResolvedEdit[] = [];

        for (const edit of ordered) {
            // Defensive: only replace when the text is still exactly what we matched.
            if (content.slice(edit.index, edit.index + edit.before.length) !== edit.before) {
                result.skipped.push(edit);
                continue;
            }
            content =
                content.slice(0, edit.index) + edit.after + content.slice(edit.index + edit.before.length);
            appliedHere.push(edit);
        }

        if (content !== original) {
            result.files.set(filePath, content);
            result.applied.push(...appliedHere);
        } else {
            // No net change: nothing is written, so nothing was applied.
            result.skipped.push(...appliedHere);
        }
    }

    return result;
}

/**
 * ⭐⭐ THE SAFETY NET (G3). Does this rewrite differ from the original by EXACTLY the
 * edits we intended, and nothing else?
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * During G3's live verification a real project came back with every `className`,
 * `id` and several opening tags stripped out of `src/app/page.tsx`, and the rebuilt
 * app was published completely unstyled. `applyEdits` is provably surgical — a unit
 * test asserts identical length and identical `className` count for a one-token
 * change — so the transformation did not come from here, and the most likely
 * candidate is upstream (G2 independently recorded a rebuild taking a healthy sandbox
 * down). **But "probably not us" is not good enough when the failure mode is
 * destroying someone's source file.**
 *
 * So the write path no longer trusts its own arithmetic. Every file is checked
 * against the original before it is sent: the length must have moved by exactly the
 * sum of the edits' deltas, and removing the edited spans must leave the two strings
 * identical. Anything else is refused and reported, not written.
 *
 * This cannot fix a corrupting rebuild — nothing on this side can. It guarantees the
 * platform is not the one holding the knife.
 */
export function verifyEdits(
    original: string,
    rewritten: string,
    edits: ResolvedEdit[]
): { safe: true } | { safe: false; reason: string } {
    const expectedDelta = edits.reduce((total, edit) => total + (edit.after.length - edit.before.length), 0);
    const actualDelta = rewritten.length - original.length;

    if (actualDelta !== expectedDelta) {
        return {
            safe: false,
            reason: `length moved by ${actualDelta}, expected ${expectedDelta}`,
        };
    }

    /**
     * Reconstruct the original from the rewrite by undoing each edit back-to-front,
     * exactly the order `applyEdits` applied them. If the result is not byte-identical
     * to what we read, something other than our edits changed the file.
     */
    const ordered = [...edits].sort((a, b) => a.index - b.index);
    let cursor = 0;
    let rebuilt = "";
    let shift = 0;

    for (const edit of ordered) {
        const at = edit.index + shift;
        if (rewritten.slice(at, at + edit.after.length) !== edit.after) {
            return { safe: false, reason: `edit ${edit.changeId} is not at the index we wrote it to` };
        }
        rebuilt += rewritten.slice(cursor, at) + edit.before;
        cursor = at + edit.after.length;
        shift += edit.after.length - edit.before.length;
    }
    rebuilt += rewritten.slice(cursor);

    if (rebuilt !== original) {
        return { safe: false, reason: "the rewrite differs from the source outside the edited spans" };
    }

    return { safe: true };
}

// ─── Tailwind class helpers (colour + text size) ─────────────────────────────

/**
 * The text-size scale, smallest to largest. Used by the inspector's A− / A+ so the
 * result stays a real Tailwind class rather than an inline style — inline styles
 * would win over the project's own responsive classes and look broken on a phone.
 */
export const TEXT_SIZE_SCALE = [
    "text-xs", "text-sm", "text-base", "text-lg", "text-xl",
    "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl", "text-7xl",
] as const;

const SIZE_PATTERN = /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)$/;

/**
 * ⭐ G3 — ARBITRARY FONT SIZES, because that is what the generator actually emits.
 *
 * The audit measured `text-[3.6rem]`, `text-[1.65rem]`, `text-[5.5rem]` on a real
 * generated page. The named scale above matches none of them, so `currentTextSize`
 * returned `null` and A+ **appended `text-lg`** — asking a 3.6 rem hero heading to
 * become 1.125 rem. Recognising the arbitrary form is what makes the size control
 * correct on real output rather than only on the fixtures.
 *
 * ⚠️ IT MUST NOT MATCH AN ARBITRARY *COLOUR*. `text-[#ff0000]` is the same shape, so
 * the value is required to end in a length unit.
 */
const ARBITRARY_SIZE_PATTERN = /^text-\[(\d*\.?\d+)(rem|px|em|pt)\]$/;

/**
 * A non-colour `text-*` utility. Everything else beginning `text-` is treated as a
 * colour and replaced.
 *
 * ⚠️ G3 — WHY THIS LIST EXISTS. The old `COLOR_PATTERN` only matched
 * `text-<word>[-<number>]`, so the generator's own custom palette (`text-bean-ink`,
 * `text-bean-clay`) was never removed and a colour edit *appended* a second colour
 * utility next to it. Which one won then depended on the order Tailwind happened to
 * emit them in — i.e. the colour picker was a coin toss. Inverting the test (everything
 * is a colour unless it is one of these) is what makes a custom palette replaceable.
 */
const TEXT_NON_COLOR = new Set([
    "left", "center", "right", "justify", "start", "end",
    "wrap", "nowrap", "balance", "pretty", "ellipsis", "clip",
    "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
]);

/**
 * ⭐⭐ AN ARBITRARY VALUE IS A COLOUR ONLY IF IT LOOKS LIKE ONE.
 *
 * ⚠️⚠️ THE OPPOSITE RULE DESTROYED HEADINGS, AND IT WAS MEASURED. This test used to
 * be "a colour unless it is a bare length", so `text-[clamp(2.9rem,7.2vw,5.2rem)]`
 * — not a bare length — was classified as a colour, DELETED by `setColorClass`, and
 * replaced with `text-[#cf5230]`. Recolouring the h1 of a real generated project
 * dropped it from 5.2rem to 16px in the same click. Generated projects reach for
 * `clamp()` on exactly the headings people click first, so this was not an edge case.
 *
 * Inverting it is also the safer failure. Guess "colour" wrongly and a size class is
 * silently deleted — visible, destructive, and blamed on the colour picker. Guess
 * "not a colour" wrongly and an old colour utility survives beside the new one, where
 * the later utility usually wins and the worst case is one redundant class in the
 * source. `var(--x)` is deliberately on the safe side of that trade: it could be
 * either, so it is kept.
 */
function isArbitraryColorValue(inner: string): boolean {
    const value = inner.trim().toLowerCase();
    if (value.startsWith("#")) return true;
    return /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(value);
}

function isColorToken(token: string, kind: "text" | "bg" | "border"): boolean {
    if (!token.startsWith(`${kind}-`)) return false;
    const value = token.slice(kind.length + 1);
    if (!value) return false;

    // Arbitrary values: a colour only when the value itself reads as one.
    if (value.startsWith("[")) {
        const inner = value.slice(1, value.endsWith("]") ? -1 : undefined);
        return isArbitraryColorValue(inner);
    }

    if (kind === "text") {
        // `text-lg`, `text-center`, `text-balance`… are not colours.
        if (TEXT_NON_COLOR.has(value)) return false;
        // `text-opacity-50` is a modifier, not a colour.
        if (value.startsWith("opacity-")) return false;
    }
    if (kind === "border") {
        // `border-2`, `border-x`, `border-solid`… are not colours.
        if (/^\d+$/.test(value)) return false;
        if (["x", "y", "t", "r", "b", "l", "solid", "dashed", "dotted", "double", "none", "hidden"].includes(value)) {
            return false;
        }
    }
    return true;
}

/**
 * The current size class, or `null` when the element has none.
 *
 * Skips responsive/state-prefixed variants (`sm:text-…`, `hover:text-…`): those are
 * additional breakpoints, and rewriting one of them while the base class stays put
 * would change the element at one width only.
 */
export function currentTextSize(className: string | null): string | null {
    if (!className) return null;
    return (
        className
            .split(/\s+/)
            .find(token => SIZE_PATTERN.test(token) || ARBITRARY_SIZE_PATTERN.test(token)) ?? null
    );
}

/** Step an arbitrary size such as `text-[3.6rem]` by one perceptual notch. */
function stepArbitrarySize(token: string, direction: 1 | -1): string | null {
    const match = ARBITRARY_SIZE_PATTERN.exec(token);
    if (!match) return null;

    const value = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(value) || value <= 0) return null;

    // 1.15× per press — close to the ratio between adjacent Tailwind steps, so one
    // press feels like one step whichever form the project happens to use.
    const next = direction === 1 ? value * 1.15 : value / 1.15;

    // Bounds in the token's own unit, so a step can never produce 0 or something absurd.
    const [min, max] = unit === "px" ? [8, 240] : unit === "pt" ? [6, 180] : [0.5, 16];
    const clamped = Math.min(max, Math.max(min, next));

    // Two decimals, trailing zeros dropped: 3.6 → 4.14, 1 → 1.15, 2.0 → 2.
    const rounded = Number(clamped.toFixed(2));
    return `text-[${rounded}${unit}]`;
}

/**
 * Step the text size up or down, returning the whole new class string.
 *
 * ⚠️ WHEN THERE IS NO SIZE CLASS we ADD one at the end rather than guessing which
 * of the project's classes was responsible. Appending is safe: Tailwind's cascade is
 * source-order-independent, and a later utility of the same property wins.
 */
export function stepTextSize(className: string | null, direction: 1 | -1): string {
    const tokens = (className || "").split(/\s+/).filter(Boolean);

    // 1 · an arbitrary value (`text-[3.6rem]`) — step it numerically, in place.
    const arbitraryIndex = tokens.findIndex(token => ARBITRARY_SIZE_PATTERN.test(token));
    if (arbitraryIndex !== -1) {
        const stepped = stepArbitrarySize(tokens[arbitraryIndex], direction);
        if (stepped) {
            tokens[arbitraryIndex] = stepped;
            return tokens.join(" ");
        }
    }

    // 2 · a named scale value — step along the scale, in place.
    const currentIndex = tokens.findIndex(token => SIZE_PATTERN.test(token));
    if (currentIndex !== -1) {
        const index = TEXT_SIZE_SCALE.indexOf(tokens[currentIndex] as (typeof TEXT_SIZE_SCALE)[number]);
        const next = TEXT_SIZE_SCALE[clamp(index + direction, 0, TEXT_SIZE_SCALE.length - 1)];
        tokens[currentIndex] = next;
        return tokens.join(" ");
    }

    // 3 · no size at all: start from `text-base` and step from there. Appending is safe —
    // a later utility of the same property wins, and there is nothing to conflict with.
    const start = TEXT_SIZE_SCALE.indexOf("text-base");
    const next = TEXT_SIZE_SCALE[clamp(start + direction, 0, TEXT_SIZE_SCALE.length - 1)];
    return [...tokens, next].join(" ");
}

/**
 * Replace (or add) a colour utility of one kind.
 *
 * ⚠️ ARBITRARY VALUES (`text-[#ff0000]`) ARE WHAT WE WRITE, deliberately. A named
 * Tailwind colour would only work if the project's config defines it; an arbitrary
 * value is guaranteed to compile in Tailwind 3+ and renders exactly the colour the
 * user picked in the swatch.
 */
export function setColorClass(
    className: string | null,
    kind: "text" | "bg" | "border",
    hex: string
): string {
    const tokens = (className || "").split(/\s+/).filter(Boolean);
    /**
     * ⚠️ ONLY UNPREFIXED TOKENS ARE REPLACED. `dark:text-white` and `hover:text-red-500`
     * are different states; removing them because the user set a base colour would
     * silently delete the project's dark-mode or hover styling.
     */
    const kept = tokens.filter(token => token.includes(":") || !isColorToken(token, kind));
    return [...kept, `${kind}-[${hex}]`].join(" ");
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** A one-line human summary of a change, for the unsaved-changes list. */
export function describeChange(change: VisualChange): { kind: VisualChangeKind; from: string; to: string } {
    const shorten = (value: string) => (value.length > 42 ? `${value.slice(0, 41)}…` : value);
    return { kind: change.kind, from: shorten(change.before), to: shorten(change.after) };
}

// ─── Naming a change in words (G4) ───────────────────────────────────────────

/**
 * The kind of thing an element IS, from its tag. Used to build labels like
 * "Heading text" and "Button colour" instead of showing a raw class string.
 */
export type ElementRole =
    | "heading" | "paragraph" | "button" | "link" | "image" | "video"
    | "listItem" | "label" | "quote" | "element";

export function roleOf(signature: Pick<ElementSignature, "tag">): ElementRole {
    const tag = (signature.tag || "").toLowerCase();
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (tag === "p") return "paragraph";
    if (tag === "button") return "button";
    if (tag === "a") return "link";
    if (tag === "img" || tag === "picture") return "image";
    if (tag === "video" || tag === "source") return "video";
    if (tag === "li") return "listItem";
    if (tag === "label") return "label";
    if (tag === "blockquote") return "quote";
    return "element";
}

/**
 * What ABOUT the element changed. A class edit is not "a style change" to a user —
 * it is a size change or a colour change, and which one is knowable from the diff.
 */
export type ChangeAspect = "text" | "size" | "textColor" | "bgColor" | "style" | "media";

/**
 * ⭐ G4 — WHY THIS EXISTS. The unsaved list used to read
 *
 *     Style  font-display text-[1.65rem] text-bean-ink → font-display text-[1.65rem]…
 *
 * three times over, with the meaningful part truncated away — so three different
 * edits looked identical and none of them was reviewable. Naming the ASPECT from the
 * diff turns that into "Heading size" / "Button colour", which is what the user
 * actually did.
 */
/**
 * EVERY aspect the change covers, most specific first.
 *
 * ⚠️⚠️ G4 — A CHANGE CAN BE MORE THAN ONE THING, AND SAYING OTHERWISE IS A LIE ABOUT
 * WHAT DISCARDING IT WILL DO. Consecutive class edits to one element are deliberately
 * collapsed into a single change (see `pushChange` — the second edit's `before` no
 * longer exists in the source, so it could never be resolved on its own). Make a
 * heading bigger and then recolour it and you get ONE entry — which `aspectOf` used to
 * label "Heading colour", with the size edit invisible. Undoing that row reverts both.
 *
 * So the row now names both: "Heading size and colour". Only class edits can carry
 * more than one aspect; text and media are always singular.
 */
export function aspectsOf(change: VisualChange): ChangeAspect[] {
    if (change.kind === "text") return ["text"];
    if (change.kind === "src") return ["media"];

    const before = new Set((change.before || "").split(/\s+/).filter(Boolean));
    const after = (change.after || "").split(/\s+/).filter(Boolean);
    const added = after.filter(token => !before.has(token));
    const removed = [...before].filter(token => !after.includes(token));

    const found: ChangeAspect[] = [];
    const add = (aspect: ChangeAspect) => {
        if (!found.includes(aspect)) found.push(aspect);
    };

    if (added.some(token => SIZE_TOKEN.test(token))) add("size");
    if (added.some(token => /^text-\[#/.test(token))) add("textColor");
    if (added.some(token => /^bg-\[#/.test(token))) add("bgColor");

    // A token removed or replaced in place, with nothing recognisable added: fall back
    // to whichever family lost a token. Only consulted for families not already found,
    // because a replacement shows up in BOTH lists and would otherwise double-count.
    if (!found.includes("size") && removed.some(token => SIZE_TOKEN.test(token))) add("size");
    if (!found.includes("textColor") && removed.some(token => /^text-/.test(token) && !SIZE_TOKEN.test(token))) {
        add("textColor");
    }
    if (!found.includes("bgColor") && removed.some(token => /^bg-/.test(token))) add("bgColor");

    return found.length ? found : ["style"];
}

const SIZE_TOKEN = /^text-(xs|sm|base|lg|xl|\dxl|\[\d*\.?\d+(rem|px|em|pt)\])$/;
