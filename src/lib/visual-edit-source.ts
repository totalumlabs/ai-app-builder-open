/**
 * ═══ THE SOURCE MODEL: WHAT THE FILES ACTUALLY SAY (Feature G5) ═════════════
 *
 * ⚠️⚠️ THIS REPLACES REGEX MATCHING, AND THE REASON IS A MEASURED FAILURE RATE.
 * A user applied twelve visual changes to a real project: **two landed and ten came
 * back unmappable** — `not-found`, `low-confidence` and `ambiguous`, all three. Every
 * one of those failures traces to the same root cause: `visual-edit.ts` looked for the
 * *rendered* string inside the *source* text, and on a real Next.js + Tailwind project
 * those two strings are almost never equal.
 *
 *   · `<Button className="px-4">` renders `class="inline-flex … px-4"` — the DOM value
 *     is `cn(buttonVariants(), "px-4")`'s **merged output**, which appears in no file.
 *   · `` className={`${base} p-4 ${font.className}`} `` — the DOM holds a build hash.
 *   · `<p>Don&apos;t stop</p>` renders `Don't stop` — the source has an entity.
 *   · `<h1>\n  Two   words\n</h1>` renders `Two words` — the source has newlines.
 *   · A component file scored **0** for the route, so a *unique, obviously correct*
 *     match was refused as `low-confidence`.
 *   · Two identical cards → two identical class strings → permanently `ambiguous`.
 *
 * No amount of regex tuning fixes that list, because the problem is not the pattern —
 * it is that a class attribute is an **expression**, not a string, and JSX text is a
 * **node**, not a substring. So this module parses the file (TypeScript's own TSX
 * parser, already a dependency) and hands the matcher a structural model:
 *
 *   every JSX element · its tag · its attributes and their exact spans · the STATIC
 *   class tokens it contributes and where each one lives · its text children, decoded
 *   and collapsed the way a browser would · its parent, its siblings, its position ·
 *   and whether it sits inside a `.map()` (i.e. renders many DOM nodes).
 *
 * ⚠️ IT NEVER EVALUATES ANYTHING. `cn(a, "b")` contributes the token `b` and is marked
 * dynamic; it does not try to guess what `a` is. Everything downstream is built on
 * "the source says at least this", never "the source says exactly this".
 *
 * Unit-tested by `src/lib/__tests__/visual-edit-source.test.ts`.
 */

import ts from "typescript";

// ─── Text, the way a browser sees it ─────────────────────────────────────────

/**
 * The named entities that actually appear in generated React source.
 *
 * ⚠️ THIS LIST EXISTS BECAUSE OF `react/no-unescaped-entities`. Next's own ESLint
 * config errors on a bare apostrophe in JSX, so every generated project is full of
 * `Don&apos;t` and `&quot;` — and the DOM reports `Don't`. Comparing the two without
 * decoding is how a perfectly ordinary heading becomes "we couldn't find that exact
 * text in the source".
 */
const NAMED_ENTITIES: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    ndash: "–", mdash: "—", hellip: "…", copy: "©", reg: "®", trade: "™",
    lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
    laquo: "«", raquo: "»", middot: "·", bull: "•", times: "×", divide: "÷",
    deg: "°", euro: "€", pound: "£", yen: "¥", cent: "¢", sect: "§", para: "¶",
    dagger: "†", permil: "‰", larr: "←", rarr: "→", uarr: "↑", darr: "↓",
    harr: "↔", check: "✓", star: "★", frac12: "½", frac14: "¼", frac34: "¾",
    eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ntilde: "ñ",
    aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", uuml: "ü", ouml: "ö", auml: "ä",
};

export function decodeEntities(value: string): string {
    return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,8});/g, (whole, body: string) => {
        if (body[0] === "#") {
            const code = body[1] === "x" || body[1] === "X"
                ? parseInt(body.slice(2), 16)
                : parseInt(body.slice(1), 10);
            if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
            try { return String.fromCodePoint(code); } catch { return whole; }
        }
        const named = NAMED_ENTITIES[body];
        return named === undefined ? whole : named;
    });
}

/**
 * ⭐ THE ONE NORMALISATION BOTH SIDES USE.
 *
 * The DOM's `textContent` has already had its entities resolved and — for ordinary
 * (non-`pre`) content — its runs of whitespace collapsed by CSS. So a comparison
 * between source and DOM is only meaningful after the source has been put through the
 * same two steps. ` ` is folded to a plain space as well: `&nbsp;` and ` ` look
 * identical to the person who typed the heading.
 */
export function normalizeText(value: string | null | undefined): string {
    if (!value) return "";
    return decodeEntities(value).replace(/[\s ]+/g, " ").trim();
}

/**
 * ⭐⭐ G6 — THE SAME NORMALISATION, EXCEPT A NEWLINE SURVIVES.
 *
 * ⚠️ A `<br/>` IS THE ONLY THING IN AN ELEMENT'S OWN TEXT THAT `normalizeText` MUST NOT
 * FLATTEN. `<h1>Bean<br/>There</h1>` is two lines to the person who wrote it and two
 * lines on screen; `textContent` reports `"BeanThere"` because a `<br>` contributes no
 * characters at all. The agent therefore reads such a heading as `"Bean\nThere"`, and
 * the source has to assemble the same string or the two can never be compared.
 *
 * Everything else behaves exactly like `normalizeText` — spaces, tabs and `&nbsp;`
 * collapse, the ends are trimmed — so for the overwhelming majority of elements, which
 * contain no `<br/>` at all, the two functions return the identical string.
 */
export function normalizeLinearText(value: string | null | undefined): string {
    if (!value) return "";
    return decodeEntities(value)
        .replace(/[^\S\n]+/g, " ")
        .replace(/ *\n */g, "\n")
        .trim();
}

/**
 * ⭐⭐⭐ JSX WHITESPACE IS NOT HTML WHITESPACE, AND ASSUMING IT WAS COST US A THIRD OF
 * THE MATCHES.
 *
 * ⚠️⚠️ MEASURED ON A REAL RENDERED PAGE. This markup —
 *
 *     <section>
 *       <h2>1. Introduction</h2>
 *       <p>We are committed to…</p>
 *     </section>
 *
 * — renders `textContent === "1. IntroductionWe are committed to…"`. **With no space.**
 * The newline-plus-indent between the two children is a whitespace-only JSX text node
 * containing a newline, and the compiler DELETES those outright; only a browser would
 * have collapsed it to a single space. Treating it as HTML produced "1. Introduction We
 * are committed…", which disagreed with the DOM by one character — and the disagreement
 * rule then eliminated the one correct candidate on the page.
 *
 * This is Babel's `cleanJSXElementLiteralChild`, reimplemented: per line, drop the
 * indentation, drop empty lines entirely, and join what survives with single spaces.
 */
export function cleanJsxText(raw: string): string {
    const lines = raw.split(/\r\n|\n|\r/);
    let lastNonEmpty = -1;
    for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) lastNonEmpty = i;

    let out = "";
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].replace(/\t/g, " ");
        if (i !== 0) line = line.replace(/^ +/, "");
        if (i !== lines.length - 1) line = line.replace(/ +$/, "");
        if (!line) continue;
        if (i !== lastNonEmpty) line += " ";
        out += line;
    }
    return out;
}

/** Split a class attribute value into tokens, ignoring the whitespace it was written with. */
export function classTokens(value: string | null | undefined): string[] {
    if (!value) return [];
    return value.split(/\s+/).filter(Boolean);
}

// ─── The model ───────────────────────────────────────────────────────────────

/**
 * One run of literal text inside a class expression, and the exact characters it
 * occupies in the file.
 *
 * ⭐ THE SLOT, NOT THE ATTRIBUTE, IS THE UNIT OF A CLASS EDIT. `cn("rounded-md px-4",
 * isActive && "bg-primary")` has two slots; a colour change that removes `bg-primary`
 * has to know which of them to touch, and that it must NOT append its new colour to the
 * conditional one.
 */
export interface ClassSlot {
    /** Inclusive start of the literal's *content* (inside the quotes/backticks). */
    start: number;
    /** Exclusive end of the literal's content. */
    end: number;
    text: string;
    tokens: string[];
    /**
     * The slot only renders under some condition (`a && "x"`, `a ? "x" : "y"`, an
     * object value). Tokens here are still findable, but nothing new may be added to
     * them — an appended colour would apply only in one of the two states.
     */
    conditional: boolean;
}

export interface AttrInfo {
    name: string;
    /** The whole attribute, `foo="bar"`, for deletion or replacement. */
    start: number;
    end: number;
    /** A static string value when the attribute has one, else `null`. */
    value: string | null;
    /** Content span of the string literal (inside the quotes) when `value !== null`. */
    valueStart: number;
    valueEnd: number;
    /** `true` when the value is `{…}` rather than a quoted string. */
    dynamic: boolean;
    /** The expression source, for following an identifier to its definition. */
    expressionText: string | null;
}

export interface TextSlot {
    /** Raw span in the file, whitespace included — replacing it preserves the layout. */
    start: number;
    end: number;
    raw: string;
    /** Entity-decoded, whitespace-collapsed: what the browser shows. */
    value: string;
    /** `jsx` for bare JSX text, `string` for `{"like this"}`. */
    kind: "jsx" | "string";
}

/** How a new class token can be added to an element. */
export type ClassAppendTarget =
    /** Extend an existing literal run: insert at `at` (end of the slot's content). */
    | { kind: "slot"; at: number }
    /** `cn(…)` — insert `, "tokens"` just before the closing paren. */
    | { kind: "call"; at: number }
    /** `className={expr}` with nothing literal in it — wrap into a template literal. */
    | { kind: "wrap"; exprStart: number; exprEnd: number }
    /** No class attribute at all — insert one right after the tag name. */
    | { kind: "attribute"; at: number };

export interface SourceElement {
    index: number;
    filePath: string;
    /** As written: `div`, `Button`, `motion.div`. */
    tag: string;
    /** The DOM tag this element will produce, when that is knowable (`div`), else null. */
    domTag: string | null;
    /** Capitalised or dotted tag names are components — they render *something else*. */
    isComponent: boolean;

    start: number;
    end: number;
    /** Just past the tag name in the opening tag: where a new attribute goes. */
    attrInsertAt: number;

    attrs: AttrInfo[];
    idValue: string | null;

    classAttr: AttrInfo | null;
    classSlots: ClassSlot[];
    /** Every token the source can prove this element has. */
    staticClassTokens: string[];
    /**
     * The tokens that render UNCONDITIONALLY.
     *
     * ⚠️ THE DIFFERENCE MATTERS FOR DISQUALIFYING. `isActive && "bg-blue-500"` may
     * legitimately be absent from the DOM, so its tokens prove nothing when missing —
     * but a token in a plain literal MUST be there, and an element whose unconditional
     * classes are missing from the rendered node is simply not that node.
     */
    unconditionalClassTokens: string[];
    /** The class expression contains something we cannot read (a variable, a call). */
    classDynamic: boolean;
    classAppend: ClassAppendTarget | null;

    texts: TextSlot[];
    /**
     * ⚠️ EVERY text run, INCLUDING THE WHITESPACE-ONLY ONES, in source order.
     *
     * ⚠️⚠️ `texts` DELIBERATELY DROPS EMPTY RUNS — they are not editable — AND USING IT
     * TO ASSEMBLE `subtreeText` WAS A MEASURABLE BUG. In
     *
     *     <p>
     *       <strong>Service providers:</strong>
     *       we share data with vendors
     *     </p>
     *
     * the newline between the two children is the only separator there is. Dropping it
     * assembled "Service providers:we share data" while the browser reports "Service
     * providers: we share data" — so the element's own text DISAGREED with the DOM and
     * the correct candidate was eliminated by the very rule meant to find it.
     */
    textRuns: { start: number; raw: string }[];
    /**
     * Normalised text of the direct text children only.
     *
     * ⭐ G6 — `<br/>` CHILDREN COUNT AS NEWLINES HERE, and only they do. That makes this
     * field equal to what the agent reports for a two-line heading, which is what lets
     * one be matched and edited at all. See `brOnly` and `normalizeLinearText`.
     */
    ownText: string;
    /**
     * Every element child is a `<br/>` (and there is at least one).
     *
     * ⚠️ IT IS THE ONLY CHILD AN EDIT MAY WRITE THROUGH. A `<br>` holds no content, so
     * the element's text stays linear and a plain-text round trip is lossless. A
     * `<span>` or a `<strong>` holds words and styling that the same round trip would
     * destroy, so those elements are still not text-editable and the user selects the
     * child instead.
     */
    brOnly: boolean;
    /**
     * ⭐⭐ THE WHOLE SUBTREE'S TEXT, ASSEMBLED THE WAY THE BROWSER WOULD.
     *
     * ⚠️⚠️ IN SOURCE ORDER, AND CONCATENATED RATHER THAN JOINED. `<li><strong>With your
     * consent:</strong> we may share…</li>` has one text child on the `li` and one on
     * the `strong`, and the first version of this walked the element's own text before
     * its children — producing "we may share… With your consent:" and matching nothing.
     * Measured against a real rendered page, that one ordering bug was responsible for
     * FIFTEEN of eighteen refusals: every list item in a document is identical apart
     * from its text, so getting the text wrong leaves nothing to tell them apart.
     *
     * There is no separator either. JSX text nodes already carry the whitespace between
     * tags, and the browser collapses it exactly as `normalizeText` does; inserting a
     * space would produce "consent: we" where the page says "consent:we".
     */
    subtreeText: string;
    /**
     * The subtree contains an interpolation (`{title}`), so its text is only partly
     * knowable — and a disagreement with the DOM proves nothing.
     */
    dynamicText: boolean;
    hasElementChildren: boolean;

    parent: number | null;
    children: number[];
    depth: number;
    /** 1-based position among element siblings with the same tag. */
    nthOfType: number;
    /** Position in document order within the file. */
    order: number;

    /**
     * ⚠️ THIS ELEMENT RENDERS MANY DOM NODES. Inside `items.map(…)` one JSX element
     * produces one node per item, so "the source has three candidates and the DOM has
     * three cards" is not the same situation as "one source element, three cards" —
     * and the second one is not ambiguous at all.
     */
    inLoop: boolean;

    /**
     * ⭐⭐ G6 — WHICH LOOP, AND WHAT IT CALLS EACH ITEM.
     *
     * ⚠️ `inLoop: true` SAYS AN EDIT AFFECTS MANY NODES; IT DOES NOT SAY WHERE THE
     * VALUE LIVES, and that is the difference between refusing an image swap and
     * making it. `<img src={item.src}>` inside `gallery.map(item => …)` has its url in
     * `gallery`, one entry per rendered image — so knowing the iterable (`gallery`) and
     * the parameter (`item`) turns `item.src` into "the `src` of the Nth entry of
     * `gallery`", which `domOrdinal` already tells us how to count.
     *
     * `null` outside a loop, and also when the callback destructures its parameter
     * (`({ src }) => …`) — that form is readable but the mapping from a property back
     * to the array entry needs the binding pattern, so it is left to a later pass
     * rather than guessed at.
     */
    loop: { iterable: string; param: string } | null;

    /**
     * ⭐ THE COMPONENT THIS ELEMENT IS WRITTEN INSIDE, when that is a component at all.
     *
     * Needed to walk OUTWARDS: `<img src={src}>` inside `function Figure({ src })` has
     * no url of its own — the url is at every `<Figure src="…" />` call site. Without
     * the owner's name there is no way to find those.
     */
    ownerComponent: string | null;

    line: number;
    column: number;
}

export interface ImportInfo {
    /** The module specifier as written: `./Hero`, `@/components/ui/button`. */
    specifier: string;
    /** Local names bound by the import, for attributing a component tag to a file. */
    names: string[];
}

/** A string value with the span of its CONTENT — quotes excluded, so a write is exact. */
export interface ValueSpan {
    value: string;
    start: number;
    end: number;
}

/** One entry of an array literal, its string properties flattened under dotted paths. */
export interface ArrayEntry {
    properties: Map<string, ValueSpan>;
}

/**
 * A `const` the file declares, addressed the way the JSX addresses it.
 *
 * `path` is the dotted text an attribute would contain (`heroImage`, `SITE.hero.image`),
 * and `scopeStart`/`scopeEnd` bound the function that declares it — the whole file when
 * it is top level. See `ParsedFile.declarations`.
 */
export interface Declaration {
    path: string;
    span: ValueSpan | null;
    entries: ArrayEntry[] | null;
    scopeStart: number;
    scopeEnd: number;
}

export interface ParsedFile {
    path: string;
    content: string;
    elements: SourceElement[];
    imports: ImportInfo[];
    /** Top-level `const x = "…"` string constants, for `src={heroImage}`. */
    constants: Map<string, { value: string; start: number; end: number }>;
    /**
     * ⭐⭐ G6 — TOP-LEVEL ARRAYS OF OBJECTS, ENTRY BY ENTRY, WITH SPANS.
     *
     * `export const gallery = [{ src: "/g1.png", alt: "…" }, …]` is how every generated
     * project of any size holds the things it renders in a grid. `constants` already
     * flattens a single object literal (`assets.hero`), but an ARRAY needs its entries
     * kept apart and in order — the whole point is to edit the SECOND one because the
     * user clicked the second image.
     */
    arrays: Map<string, { properties: Map<string, { value: string; start: number; end: number }> }[]>;
    /**
     * ⭐⭐⭐ EVERY STRING AND EVERY ARRAY IN THE FILE, AT EVERY SCOPE, UNDER ITS PATH.
     *
     * ⚠️⚠️ `constants` AND `arrays` ONLY EVER SAW `source.statements` — the file's TOP
     * LEVEL — and that is why image replacement failed on real projects while text kept
     * working. Text has a raw-text tier behind it (`findTextInData` greps the files), so
     * copy held in a local array is still found. A `src` has no such tier by design: the
     * blind matcher once rewrote an unrelated `<picture>` forty lines away, so a located
     * element is never demoted to it. Everything the AST could not see was therefore
     * refused outright, with "this value is built by your code rather than written in it"
     * — about a url that is written, plainly, four lines above the markup:
     *
     *     export default function Home() {
     *       const heroImage = "/img/hero.jpg";              // ← invisible: not top level
     *       const team = [{ photo: "/img/ana.jpg" }, …];    // ← invisible: not top level
     *       return <img src={heroImage} />;
     *     }
     *
     * That is not an exotic shape; it is how a generated page is normally written.
     *
     * ⚠️ EACH ENTRY CARRIES THE SCOPE THAT CAN SEE IT, so two components in one file that
     * both declare `images` are told apart by which one contains the element being
     * edited — rather than the first one silently winning. The whole file is the scope of
     * a top-level const, which keeps every case that worked before working.
     */
    declarations: Declaration[];
    /**
     * ⭐⭐ WHICH COMPONENTS IN THIS FILE ACTUALLY PASS `className` THROUGH.
     *
     * ⚠️⚠️ WITHOUT THIS, A COLOUR CHANGE CAN "SUCCEED" AND CHANGE NOTHING — which is worse
     * than refusing, because the user is told it worked, waits through a rebuild, and pays
     * for it. Measured on a page of real shapes:
     *
     *     function Card({ title, body, tone }) { return <article className={cn(…)}>…      // no className prop
     *     …
     *     <Card title={f.title} body={f.body} />                                          // the call site
     *
     * The call site is normally the RIGHT place to write — `<Button className="px-8">`
     * works because shadcn components destructure `className` and merge it. `Card` does
     * not, so `className` written there is silently dropped by React and the pixels never
     * move. The only edit that changes anything is the one inside the component.
     */
    components: Map<string, { forwardsClassName: boolean }>;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

const CLASS_HELPERS = new Set(["cn", "clsx", "classnames", "classNames", "cx", "twMerge", "twJoin", "tw", "cva", "clsxm"]);
const LOOP_METHODS = new Set(["map", "flatMap", "forEach"]);

/**
 * ⚠️ PARSING IS CACHED BY CONTENT, NOT BY PATH. An apply reads up to 120 files and
 * resolves up to 100 changes against all of them; re-parsing per change would be
 * quadratic. Keyed on the content itself so a file that changed between reads can
 * never answer from the cache.
 */
const parseCache = new Map<string, ParsedFile>();
const PARSE_CACHE_LIMIT = 400;

function cacheKey(path: string, content: string): string {
    // Cheap, collision-tolerant: length + a sampled hash. A miss only costs a re-parse.
    let hash = 0;
    for (let i = 0; i < content.length; i += 61) hash = (hash * 31 + content.charCodeAt(i)) | 0;
    return `${path}:${content.length}:${hash}`;
}

export function parseSourceFile(path: string, content: string): ParsedFile {
    const key = cacheKey(path, content);
    const cached = parseCache.get(key);
    if (cached) return cached;

    const parsed = parseUncached(path, content);

    if (parseCache.size >= PARSE_CACHE_LIMIT) {
        // Cheapest possible eviction: drop the oldest insertion.
        const oldest = parseCache.keys().next().value;
        if (oldest !== undefined) parseCache.delete(oldest);
    }
    parseCache.set(key, parsed);
    return parsed;
}

function parseUncached(path: string, content: string): ParsedFile {
    const file: ParsedFile = {
        path,
        content,
        elements: [],
        imports: [],
        constants: new Map(),
        arrays: new Map(),
        declarations: [],
        components: new Map(),
    };

    let source: ts.SourceFile;
    try {
        source = ts.createSourceFile(
            path.endsWith(".jsx") || path.endsWith(".js") ? `${path}x` : path,
            content,
            ts.ScriptTarget.Latest,
            /* setParentNodes */ true,
            ts.ScriptKind.TSX
        );
    } catch {
        // A file we cannot parse contributes nothing rather than breaking the batch.
        return file;
    }

    collectImportsAndConstants(source, file);
    collectDeclarations(source, file);
    collectComponents(source, file);

    /**
     * ⚠️ THE WALK CARRIES THE JSX PARENT, NOT THE AST PARENT. Between a `<ul>` and its
     * `<li>` there can be a `.map()` callback, a fragment, a conditional and a
     * `JsxExpression` — none of which are elements. The matcher reasons about the DOM
     * tree the user clicked in, so the model has to skip everything that is not an
     * element while remembering that it passed through a loop.
     */
    const walk = (
        node: ts.Node,
        parent: number | null,
        depth: number,
        inLoop: boolean,
        /** ⭐ G6 — the innermost `.map()` we have passed through, and the component we are in. */
        loop: SourceElement["loop"],
        owner: string | null
    ) => {
        let nextParent = parent;
        let nextDepth = depth;
        let nextInLoop = inLoop;
        let nextLoop = loop;
        let nextOwner = owner;

        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            if (LOOP_METHODS.has(node.expression.name.text)) {
                nextInLoop = true;
                nextLoop = describeLoop(source, node) ?? loop;
            }
        }

        /**
         * ⚠️ THE OWNER IS THE NEAREST CAPITALISED FUNCTION, not the file's default
         * export. A file can declare several components (`Card` next to the page), and
         * an `<img src={src}>` belongs to whichever one lexically encloses it.
         */
        const declared = declaredComponentName(node);
        if (declared) nextOwner = declared;

        if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
            const element = buildElement(source, file, node, parent, depth, nextInLoop, nextLoop, nextOwner);
            file.elements.push(element);
            if (parent !== null) file.elements[parent].children.push(element.index);
            nextParent = element.index;
            nextDepth = depth + 1;
        }

        ts.forEachChild(node, child => walk(child, nextParent, nextDepth, nextInLoop, nextLoop, nextOwner));
    };

    walk(source, null, 0, false, null, null);

    // Second pass: things that need the children to exist.
    for (const element of file.elements) {
        element.hasElementChildren = element.children.length > 0;
        /**
         * ⭐ G6 — `<br/>`-only children, and the linear text that follows from them.
         *
         * ⚠️ IT CANNOT BE DONE IN `buildElement`, because a parent is built BEFORE its
         * children exist — which is the same reason `hasElementChildren` is set here.
         */
        element.brOnly =
            element.children.length > 0 &&
            element.children.every(child => file.elements[child].domTag === "br");
        if (element.brOnly) element.ownText = linearOwnTextOf(file, element);
        const subtree = subtreeTextOf(file, element);
        element.subtreeText = subtree.text;
        // A descendant's interpolation makes THIS element's text unknowable too.
        element.dynamicText = element.dynamicText || subtree.dynamic;
    }
    assignNthOfType(file);

    return file;
}

/**
 * `gallery.map(item => …)` → `{ iterable: "gallery", param: "item" }`.
 *
 * ⚠️ A DESTRUCTURED PARAMETER RETURNS `null`, NOT A GUESS. `({ src }) => …` is perfectly
 * ordinary code, but recovering "which array property is this" from the binding pattern
 * is a different lookup, and answering with a made-up parameter name would send the
 * planner searching for `undefined.src`.
 */
function describeLoop(source: ts.SourceFile, node: ts.CallExpression): SourceElement["loop"] {
    if (!ts.isPropertyAccessExpression(node.expression)) return null;
    const iterable = node.expression.expression.getText(source);
    if (!iterable) return null;

    const callback = node.arguments[0];
    if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) return null;

    const parameter = callback.parameters[0];
    if (!parameter || !ts.isIdentifier(parameter.name)) return null;

    return { iterable, param: parameter.name.text };
}

/**
 * Every `key: "string"` in an object literal, with the span of the value's CONTENT.
 *
 * ⭐⭐ IT RECURSES, AND THAT IS THE FIX FOR `src={SITE.hero.image}`. Generated projects
 * do not keep their copy in a flat bag of keys — they keep it in the shape of the page:
 * `const SITE = { hero: { image: "…" }, about: { image: "…" } }`. Recording only the top
 * level meant every one of those urls was invisible, and an image whose url is invisible
 * is reported to the user as "built by your code rather than written in it" — which is
 * false: it is written, one level down.
 *
 * Nested keys are recorded under their DOTTED PATH (`hero.image`), which is exactly the
 * text the JSX attribute contains, so the planner can look one up without re-parsing.
 */
const MAX_OBJECT_DEPTH = 5;

function stringProperties(
    source: ts.SourceFile,
    node: ts.ObjectLiteralExpression,
    prefix = "",
    depth = 0
): Map<string, { value: string; start: number; end: number }> {
    const out = new Map<string, { value: string; start: number; end: number }>();
    for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
            ? property.name.text
            : null;
        if (!name) continue;
        const key = prefix ? `${prefix}.${name}` : name;
        const value = property.initializer;
        if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
            out.set(key, { value: value.text, start: value.getStart(source) + 1, end: value.end - 1 });
            continue;
        }
        if (ts.isObjectLiteralExpression(value) && depth < MAX_OBJECT_DEPTH) {
            for (const [nested, span] of stringProperties(source, value, key, depth + 1)) out.set(nested, span);
        }
    }
    return out;
}

/** The component name this node DECLARES, if it declares one. */
function declaredComponentName(node: ts.Node): string | null {
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text)) return node.name.text;
    if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        /^[A-Z]/.test(node.name.text) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
            ts.isFunctionExpression(node.initializer) ||
            ts.isCallExpression(node.initializer))
    ) {
        return node.name.text;
    }
    return null;
}

function collectImportsAndConstants(source: ts.SourceFile, file: ParsedFile): void {
    for (const statement of source.statements) {
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
            const names: string[] = [];
            const clause = statement.importClause;
            if (clause?.name) names.push(clause.name.text);
            if (clause?.namedBindings) {
                if (ts.isNamedImports(clause.namedBindings)) {
                    for (const element of clause.namedBindings.elements) names.push(element.name.text);
                } else {
                    names.push(clause.namedBindings.name.text);
                }
            }
            file.imports.push({ specifier: statement.moduleSpecifier.text, names });
            continue;
        }

        /**
         * `const heroImage = "/hero.png"` — the target of `src={heroImage}`.
         *
         * ⚠️ THE AUDIT RECORDED THIS AS "NOT FIXED, AND WHY": `src={files.beanThereHero}`
         * lives in a `.ts` file the old matcher never even read. Recording the constants
         * of every file we parse is what makes following that reference possible without
         * searching unrelated code for quoted strings.
         */
        if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
                const init = declaration.initializer;
                if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
                    file.constants.set(declaration.name.text, {
                        value: init.text,
                        start: init.getStart(source) + 1,
                        end: init.end - 1,
                    });
                } else if (ts.isObjectLiteralExpression(init)) {
                    // `export const files = { hero: "/hero.png" }` → `files.hero`.
                    for (const [propertyName, span] of stringProperties(source, init)) {
                        file.constants.set(`${declaration.name.text}.${propertyName}`, span);
                    }
                } else if (ts.isArrayLiteralExpression(init)) {
                    /**
                     * ⭐ G6 — `export const gallery = [{ src: "/g1.png" }, …]`, IN ORDER.
                     *
                     * The order is the whole value of this: the user clicked the second
                     * image, `domOrdinal` says 1, and entry 1 is the one to rewrite.
                     * Entries that are not object literals are kept as empty maps rather
                     * than skipped, so the indexes still line up with the rendered nodes.
                     */
                    file.arrays.set(
                        declaration.name.text,
                        init.elements.map(entry => ({
                            properties: ts.isObjectLiteralExpression(entry)
                                ? stringProperties(source, entry)
                                : new Map(),
                        }))
                    );
                }
            }
        }
    }
}

/**
 * ⭐⭐⭐ EVERY `const` IN THE FILE, WHEREVER IT IS WRITTEN — see `ParsedFile.declarations`.
 *
 * `collectImportsAndConstants` above walks `source.statements` and therefore only ever
 * sees the top level. This walks the whole tree, so a value declared inside the component
 * that renders it is found too, and records the enclosing function as its scope so two
 * components in one file cannot be confused for each other.
 *
 * ⚠️ IT IS PURELY ADDITIVE. The top-level maps are still built exactly as before and are
 * still consulted first, so nothing that resolved yesterday resolves differently today.
 */
function collectDeclarations(source: ts.SourceFile, file: ParsedFile): void {
    /** The function that owns a declaration — the file itself when it is top level. */
    const scopeOf = (node: ts.Node): { start: number; end: number } => {
        let current: ts.Node | undefined = node.parent;
        while (current) {
            if (
                ts.isFunctionDeclaration(current) ||
                ts.isFunctionExpression(current) ||
                ts.isArrowFunction(current) ||
                ts.isMethodDeclaration(current) ||
                ts.isConstructorDeclaration(current) ||
                ts.isGetAccessorDeclaration(current) ||
                ts.isSetAccessorDeclaration(current)
            ) {
                return { start: current.getStart(source), end: current.end };
            }
            if (ts.isSourceFile(current)) break;
            current = current.parent;
        }
        return { start: 0, end: source.end };
    };

    /**
     * Flatten one initializer into the paths the JSX can name.
     *
     * A string is a leaf. An object contributes its (recursively flattened) string
     * properties AND any array it holds, so `SITE.gallery` is addressable as well as
     * `SITE.hero.image`.
     */
    const flatten = (path: string, initializer: ts.Expression, scope: { start: number; end: number }, depth: number): void => {
        if (depth > MAX_OBJECT_DEPTH) return;

        if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
            file.declarations.push({
                path,
                span: { value: initializer.text, start: initializer.getStart(source) + 1, end: initializer.end - 1 },
                entries: null,
                scopeStart: scope.start,
                scopeEnd: scope.end,
            });
            return;
        }

        if (ts.isArrayLiteralExpression(initializer)) {
            file.declarations.push({
                path,
                span: null,
                // ⚠️ Non-object entries are kept as empty maps, never skipped: the indexes
                // have to keep lining up with the rendered nodes for `domOrdinal` to mean
                // anything.
                entries: initializer.elements.map(entry => ({
                    properties: ts.isObjectLiteralExpression(entry) ? stringProperties(source, entry) : new Map(),
                })),
                scopeStart: scope.start,
                scopeEnd: scope.end,
            });
            return;
        }

        if (ts.isObjectLiteralExpression(initializer)) {
            for (const property of initializer.properties) {
                if (!ts.isPropertyAssignment(property)) continue;
                const name =
                    ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;
                if (!name) continue;
                flatten(`${path}.${name}`, property.initializer, scope, depth + 1);
            }
        }
    };

    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
            flatten(node.name.text, node.initializer, scopeOf(node), 0);
        }
        ts.forEachChild(node, visit);
    };

    try {
        visit(source);
    } catch {
        // A shape we cannot flatten costs us that one value, never the file.
    }
}

/**
 * Record every component declared in this file and whether it forwards `className`.
 *
 * Two ways of forwarding count, because both are idiomatic and both work:
 *   · destructuring the prop — `function Button({ className, …})`
 *   · spreading the rest onto an element — `<button {...props} />`
 *
 * ⚠️ UNKNOWN MEANS "ASSUME IT FORWARDS", decided at the call site rather than here. The
 * overwhelming majority of components in these projects do, and a false "it does not"
 * would push edits into a shared primitive and restyle the whole app.
 */
function collectComponents(source: ts.SourceFile, file: ParsedFile): void {
    const record = (name: string, node: ts.Node, parameters: readonly ts.ParameterDeclaration[]) => {
        if (!/^[A-Z]/.test(name)) return;

        let forwards = false;

        for (const parameter of parameters) {
            if (ts.isObjectBindingPattern(parameter.name)) {
                for (const element of parameter.name.elements) {
                    const propertyName = ts.isIdentifier(element.name) ? element.name.text : "";
                    const sourceName = element.propertyName && ts.isIdentifier(element.propertyName)
                        ? element.propertyName.text
                        : propertyName;
                    // `className` destructured, or a rest element (`...props`) that could carry it.
                    if (sourceName === "className" || element.dotDotDotToken) forwards = true;
                }
            } else if (ts.isIdentifier(parameter.name)) {
                // `function Card(props)` — only forwarding proves anything; the spread below.
            }
        }

        if (!forwards) {
            const findSpread = (current: ts.Node): boolean => {
                if (ts.isJsxSpreadAttribute(current)) return true;
                return ts.forEachChild(current, findSpread) ?? false;
            };
            forwards = findSpread(node);
        }

        const existing = file.components.get(name);
        file.components.set(name, { forwardsClassName: existing ? existing.forwardsClassName || forwards : forwards });
    };

    const visit = (node: ts.Node) => {
        if (ts.isFunctionDeclaration(node) && node.name) {
            record(node.name.text, node, node.parameters);
        } else if (ts.isVariableStatement(node)) {
            for (const declaration of node.declarationList.declarations) {
                if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
                const init = declaration.initializer;
                if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
                    record(declaration.name.text, init, init.parameters);
                } else if (ts.isCallExpression(init)) {
                    // `forwardRef((props, ref) => …)` and friends.
                    const inner = init.arguments.find(
                        argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
                    ) as ts.ArrowFunction | ts.FunctionExpression | undefined;
                    if (inner) record(declaration.name.text, inner, inner.parameters);
                    else record(declaration.name.text, init, []);
                }
            }
        }
        ts.forEachChild(node, visit);
    };

    visit(source);
}

function buildElement(
    source: ts.SourceFile,
    file: ParsedFile,
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    parent: number | null,
    depth: number,
    inLoop: boolean,
    loop: SourceElement["loop"],
    ownerComponent: string | null
): SourceElement {
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const tag = opening.tagName.getText(source);
    const isComponent = /^[A-Z]/.test(tag) || tag.includes(".");
    const position = source.getLineAndCharacterOfPosition(opening.getStart(source));

    const element: SourceElement = {
        index: file.elements.length,
        filePath: file.path,
        tag,
        domTag: isComponent ? null : tag.toLowerCase(),
        isComponent,
        start: node.getStart(source),
        end: node.end,
        attrInsertAt: opening.tagName.end,
        attrs: [],
        textRuns: [],
        idValue: null,
        classAttr: null,
        classSlots: [],
        staticClassTokens: [],
        unconditionalClassTokens: [],
        classDynamic: false,
        classAppend: null,
        texts: [],
        ownText: "",
        brOnly: false,
        subtreeText: "",
        dynamicText: false,
        hasElementChildren: false,
        parent,
        children: [],
        depth,
        nthOfType: 1,
        order: file.elements.length,
        inLoop,
        loop,
        ownerComponent,
        line: position.line + 1,
        column: position.character + 1,
    };

    for (const property of opening.attributes.properties) {
        if (!ts.isJsxAttribute(property) || !ts.isIdentifier(property.name)) continue;
        const name = property.name.text;
        const attr = describeAttribute(source, property);
        element.attrs.push(attr);

        if (name === "id" && attr.value) element.idValue = attr.value;

        if (name === "className" || name === "class") {
            element.classAttr = attr;
            const analysis = analyseClassValue(source, property.initializer);
            element.classSlots = analysis.slots;
            element.classDynamic = analysis.dynamic;
            element.classAppend = analysis.append;
            element.staticClassTokens = analysis.slots.flatMap(slot => slot.tokens);
            element.unconditionalClassTokens = analysis.slots
                .filter(slot => !slot.conditional)
                .flatMap(slot => slot.tokens);
        }
    }

    if (!element.classAttr) {
        element.classAppend = { kind: "attribute", at: element.attrInsertAt };
    }

    if (ts.isJsxElement(node)) collectTexts(source, file, node, element);

    // ⚠️ The RENDERED runs, concatenated with nothing between them — JSX inserts no
    // separator, and `cleanJsxText` has already put back the spaces that survive.
    element.ownText = normalizeText(element.textRuns.map(run => run.raw).join(""));
    return element;
}

function describeAttribute(source: ts.SourceFile, attribute: ts.JsxAttribute): AttrInfo {
    const initializer = attribute.initializer;
    const base: AttrInfo = {
        name: (attribute.name as ts.Identifier).text,
        start: attribute.getStart(source),
        end: attribute.end,
        value: null,
        valueStart: -1,
        valueEnd: -1,
        dynamic: false,
        expressionText: null,
    };

    if (!initializer) return base;

    if (ts.isStringLiteral(initializer)) {
        base.value = initializer.text;
        base.valueStart = initializer.getStart(source) + 1;
        base.valueEnd = initializer.end - 1;
        return base;
    }

    if (ts.isJsxExpression(initializer) && initializer.expression) {
        const expression = initializer.expression;
        base.dynamic = true;
        base.expressionText = expression.getText(source);
        if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
            base.value = expression.text;
            base.valueStart = expression.getStart(source) + 1;
            base.valueEnd = expression.end - 1;
            base.dynamic = false;
        }
    }
    return base;
}

/**
 * ⭐⭐ EVERY STATIC CLASS TOKEN THE SOURCE CAN PROVE, AND WHERE TO PUT A NEW ONE.
 *
 * This is the function that makes `<Button className="px-4">` editable. It walks the
 * class *expression* rather than reading a string, so `cn()`, `clsx()`, `cva()`,
 * template literals, arrays, ternaries and `&&` chains all contribute their literal
 * runs — and each run remembers whether it is conditional, because appending a colour
 * to `isActive && "bg-blue-500"` would only colour the active state.
 */
function analyseClassValue(
    source: ts.SourceFile,
    initializer: ts.JsxAttribute["initializer"]
): { slots: ClassSlot[]; dynamic: boolean; append: ClassAppendTarget | null } {
    const slots: ClassSlot[] = [];
    let dynamic = false;
    let append: ClassAppendTarget | null = null;

    const addLiteral = (node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral, conditional: boolean) => {
        const start = node.getStart(source) + 1;
        const end = node.end - 1;
        slots.push({ start, end, text: source.text.slice(start, end), tokens: classTokens(node.text), conditional });
    };

    const visit = (node: ts.Node, conditional: boolean) => {
        if (ts.isParenthesizedExpression(node)) return visit(node.expression, conditional);

        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
            addLiteral(node, conditional);
            return;
        }

        if (ts.isTemplateExpression(node)) {
            dynamic = true;
            /**
             * The static runs of `` `a ${x} b` ``. Each literal token carries its own
             * delimiters — the head ends with `${`, a middle starts with `}` and ends
             * with `${`, the tail starts with `}` — so the content span is computed per
             * kind rather than assuming quotes.
             */
            const push = (part: ts.TemplateHead | ts.TemplateMiddle | ts.TemplateTail) => {
                const raw = part.getStart(source);
                const isTail = part.kind === ts.SyntaxKind.TemplateTail;
                const start = raw + 1;
                const end = isTail ? part.end - 1 : part.end - 2;
                if (end <= start) return;
                slots.push({
                    start,
                    end,
                    text: source.text.slice(start, end),
                    tokens: classTokens(source.text.slice(start, end)),
                    conditional,
                });
            };
            push(node.head);
            for (const span of node.templateSpans) push(span.literal);
            return;
        }

        if (ts.isCallExpression(node)) {
            const callee = ts.isIdentifier(node.expression)
                ? node.expression.text
                : ts.isPropertyAccessExpression(node.expression)
                  ? node.expression.name.text
                  : "";
            if (CLASS_HELPERS.has(callee)) {
                for (const argument of node.arguments) visit(argument, conditional);
                /**
                 * ⭐ THE BEST PLACE TO ADD A TOKEN IS THE END OF THE `cn()` CALL, and
                 * not because it is convenient. `cn` is `twMerge(clsx(…))` in every
                 * project this platform generates, and `tailwind-merge` resolves a
                 * conflict in favour of the **last** class of the same family. A colour
                 * appended here therefore beats the component's own default instead of
                 * fighting it in the stylesheet.
                 */
                if (!conditional && !append) {
                    append = { kind: "call", at: node.arguments.length > 0 ? node.arguments[node.arguments.length - 1].end : node.end - 1 };
                }
                return;
            }
            dynamic = true;
            return;
        }

        if (ts.isConditionalExpression(node)) {
            dynamic = true;
            visit(node.whenTrue, true);
            visit(node.whenFalse, true);
            return;
        }

        if (ts.isBinaryExpression(node)) {
            dynamic = true;
            visit(node.left, true);
            visit(node.right, true);
            return;
        }

        if (ts.isArrayLiteralExpression(node)) {
            for (const item of node.elements) visit(item, conditional);
            return;
        }

        if (ts.isObjectLiteralExpression(node)) {
            // `{ "bg-red-500": isError }` — the KEY is the class, and it is conditional.
            dynamic = true;
            for (const property of node.properties) {
                if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name)) {
                    addLiteral(property.name, true);
                }
            }
            return;
        }

        dynamic = true;
    };

    if (!initializer) return { slots, dynamic, append };

    if (ts.isStringLiteral(initializer)) {
        addLiteral(initializer, false);
    } else if (ts.isJsxExpression(initializer) && initializer.expression) {
        visit(initializer.expression, false);
        if (!append) {
            const unconditional = slots.filter(slot => !slot.conditional);
            if (unconditional.length > 0) {
                append = { kind: "slot", at: unconditional[unconditional.length - 1].end };
            } else {
                append = {
                    kind: "wrap",
                    exprStart: initializer.expression.getStart(source),
                    exprEnd: initializer.expression.end,
                };
            }
        }
    }

    if (!append) {
        const unconditional = slots.filter(slot => !slot.conditional);
        if (unconditional.length > 0) append = { kind: "slot", at: unconditional[unconditional.length - 1].end };
    }

    return { slots, dynamic, append };
}

/**
 * The element's own text children.
 *
 * ⚠️ `{"…"}` COUNTS AS TEXT. Generated code writes `{"Don't stop"}` to dodge the
 * unescaped-entity lint rule, and to a user that is simply the heading. It is recorded
 * with `kind: "string"` so an edit knows to write a JS string, not JSX text.
 */
function collectTexts(source: ts.SourceFile, file: ParsedFile, node: ts.JsxElement, element: SourceElement): void {
    for (const child of node.children) {
        if (ts.isJsxText(child)) {
            const raw = file.content.slice(child.pos, child.end);
            /**
             * ⚠️ THE RUN IS STORED AS THE COMPILER WOULD EMIT IT (see `cleanJsxText`),
             * because that is what has to line up with the DOM. The EDITABLE slot below
             * keeps the untouched `raw` — an edit must preserve the author's indentation.
             */
            const rendered = cleanJsxText(raw);
            element.textRuns.push({ start: child.pos, raw: rendered });
            if (!normalizeText(rendered)) continue;
            element.texts.push({ start: child.pos, end: child.end, raw, value: normalizeText(rendered), kind: "jsx" });
            continue;
        }
        if (ts.isJsxExpression(child) && child.expression) {
            const expression = child.expression;
            if (!ts.isStringLiteral(expression) && !ts.isNoSubstitutionTemplateLiteral(expression)) {
                /**
                 * `{title}`, `{items.map(…)}`, `{count} items` — the rendered text is not
                 * knowable from here, so a disagreement between this element's text and
                 * the DOM's proves nothing and must not disqualify the match.
                 */
                element.dynamicText = true;
                continue;
            }
            const start = expression.getStart(source) + 1;
            const end = expression.end - 1;
            /**
             * ⚠️ `{" "}` IS THE POINT OF THIS BRANCH, not an edge case: it is how JSX
             * puts back a space the compiler would otherwise delete. It renders exactly
             * one space, so it belongs in the run list even though it is not editable.
             */
            element.textRuns.push({ start, raw: expression.text });
            if (!normalizeText(expression.text)) continue;
            element.texts.push({
                start,
                end,
                raw: file.content.slice(start, end),
                value: normalizeText(expression.text),
                kind: "string",
            });
        }
    }
}

/**
 * The element's own text with each `<br/>` child rendered as a newline, in source order.
 *
 * ⚠️ THE RUNS AND THE `<br/>`s ARE INTERLEAVED BY POSITION, not concatenated in two
 * passes — `Bean<br/>There` and `<br/>Bean There` are different headings, and reading
 * them the same way is how a match silently becomes the wrong element.
 */
function linearOwnTextOf(file: ParsedFile, element: SourceElement): string {
    const pieces: { at: number; text: string }[] = [];
    for (const run of element.textRuns) pieces.push({ at: run.start, text: run.raw });
    for (const child of element.children) pieces.push({ at: file.elements[child].start, text: "\n" });
    pieces.sort((a, b) => a.at - b.at);
    return normalizeLinearText(pieces.map(piece => piece.text).join(""));
}

function subtreeTextOf(file: ParsedFile, element: SourceElement): { text: string; dynamic: boolean } {
    let dynamic = false;

    const collect = (index: number): string => {
        const current = file.elements[index];
        if (current.dynamicText) dynamic = true;
        /**
         * Text runs and child elements, interleaved by where they appear in the file —
         * which is the order the browser will render them in.
         */
        const pieces: { at: number; text: string }[] = [];
        // ⚠️ textRuns, NOT texts — see the note on the field. The whitespace between two
        // child elements is load-bearing and `texts` does not carry it.
        for (const run of current.textRuns) pieces.push({ at: run.start, text: run.raw });
        for (const child of current.children) {
            pieces.push({ at: file.elements[child].start, text: collect(child) });
        }
        pieces.sort((a, b) => a.at - b.at);
        return pieces.map(piece => piece.text).join("");
    };

    return { text: normalizeText(collect(element.index)), dynamic };
}

function assignNthOfType(file: ParsedFile): void {
    const counters = new Map<number | string, Map<string, number>>();
    for (const element of file.elements) {
        const key = element.parent === null ? "root" : element.parent;
        let byTag = counters.get(key);
        if (!byTag) {
            byTag = new Map();
            counters.set(key, byTag);
        }
        const next = (byTag.get(element.tag) ?? 0) + 1;
        byTag.set(element.tag, next);
        element.nthOfType = next;
    }
}

// ─── Import graph ────────────────────────────────────────────────────────────

/**
 * Resolve a module specifier to a path in the file map.
 *
 * ⚠️ `@/` IS THE TEMPLATE'S ALIAS FOR `src/`, and it is how every generated project
 * imports its own components. Without this the graph stops at the first import and the
 * whole reachability signal is dead.
 */
export function resolveImport(fromPath: string, specifier: string, files: Iterable<string>): string | null {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/") && !specifier.startsWith("~/")) return null;

    const known = files instanceof Set ? (files as Set<string>) : new Set(files);

    let base: string;
    if (specifier.startsWith("@/") || specifier.startsWith("~/")) {
        base = `src/${specifier.slice(2)}`;
    } else {
        const dir = fromPath.split("/").slice(0, -1);
        const parts = specifier.split("/");
        for (const part of parts) {
            if (part === ".") continue;
            else if (part === "..") dir.pop();
            else dir.push(part);
        }
        base = dir.join("/");
    }

    const candidates = [
        base,
        `${base}.tsx`, `${base}.jsx`, `${base}.ts`, `${base}.js`,
        `${base}/index.tsx`, `${base}/index.jsx`, `${base}/index.ts`, `${base}/index.js`,
    ];
    for (const candidate of candidates) {
        if (known.has(candidate)) return candidate;
        // A project may live under `app/` instead of `src/app/`.
        if (candidate.startsWith("src/") && known.has(candidate.slice(4))) return candidate.slice(4);
    }
    return null;
}

/**
 * ⭐⭐ WHICH FILES CAN THE PAGE THE USER IS LOOKING AT POSSIBLY RENDER?
 *
 * ⚠️⚠️ THIS IS THE SINGLE BIGGEST ACCURACY WIN IN THE REWRITE, and it fixes two of the
 * three failure messages at once.
 *
 *   · `low-confidence` — the old scorer gave a **component file zero route points**, so
 *     a unique and obviously correct match inside `src/components/Hero.tsx` scored 25
 *     out of a required 45 and was refused. Reachability says "this file is what `/`
 *     renders", which is exactly the evidence that was missing.
 *   · `ambiguous` — the same heading exists in `Hero.tsx` and in an unused
 *     `HeroOld.tsx`, or in another route's page. Only one of them is reachable from
 *     the route the user was on, so there is nothing to be ambiguous about.
 *
 * Depth is returned, not just membership: the page itself is stronger evidence than a
 * component six imports away.
 */
export function reachableFromRoute(
    files: Map<string, ParsedFile>,
    route: string,
    maxDepth = 8
): Map<string, number> {
    const reachable = new Map<string, number>();
    const known = new Set(files.keys());

    const clean = (route || "/").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
    const segments = clean === "/" ? [] : clean.slice(1).split("/");

    /** Every page and every layout on the path from the root to this route. */
    const roots: string[] = [];
    for (const root of ["src/app", "app"]) {
        for (let depth = segments.length; depth >= 0; depth--) {
            const dir = depth === 0 ? root : `${root}/${segments.slice(0, depth).join("/")}`;
            for (const name of ["page.tsx", "page.jsx", "layout.tsx", "layout.jsx", "template.tsx"]) {
                const path = `${dir}/${name}`;
                // Only the *deepest* page renders; every layout above it does too.
                if (known.has(path) && (name.startsWith("layout") || name.startsWith("template") || depth === segments.length)) {
                    roots.push(path);
                }
            }
        }
    }

    /**
     * A dynamic segment (`/products/[id]`) never matches by name, so when nothing was
     * found the route is matched structurally against the app directory instead.
     */
    if (roots.length === 0 && segments.length > 0) {
        for (const path of known) {
            if (!/\/page\.[jt]sx$/.test(path)) continue;
            const fileSegments = path
                .replace(/^(src\/)?app\//, "")
                .replace(/\/page\.[jt]sx$/, "")
                .split("/")
                .filter(part => part && !part.startsWith("("));
            if (fileSegments.length !== segments.length) continue;
            if (fileSegments.every((part, index) => part === segments[index] || /^\[.+\]$/.test(part))) {
                roots.push(path);
            }
        }
    }

    const queue: { path: string; depth: number }[] = roots.map(path => ({ path, depth: 0 }));
    while (queue.length > 0) {
        const { path, depth } = queue.shift()!;
        const seen = reachable.get(path);
        if (seen !== undefined && seen <= depth) continue;
        reachable.set(path, depth);
        if (depth >= maxDepth) continue;

        const parsed = files.get(path);
        if (!parsed) continue;
        for (const entry of parsed.imports) {
            const target = resolveImport(path, entry.specifier, known);
            if (target) queue.push({ path: target, depth: depth + 1 });
        }
    }

    return reachable;
}

/** Files that import a given file — used to attribute a component tag to its definition. */
export function buildComponentIndex(files: Map<string, ParsedFile>): Map<string, string[]> {
    const index = new Map<string, string[]>();
    const known = new Set(files.keys());
    for (const [path, parsed] of files) {
        for (const entry of parsed.imports) {
            const target = resolveImport(path, entry.specifier, known);
            if (!target) continue;
            for (const name of entry.names) {
                const list = index.get(`${path}::${name}`) ?? [];
                list.push(target);
                index.set(`${path}::${name}`, list);
            }
        }
    }
    return index;
}
