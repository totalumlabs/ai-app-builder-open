/**
 * ═══ FROM A CLICKED ELEMENT TO A CHARACTER RANGE (Feature G5) ═══════════════
 *
 * The matcher. It is handed the parsed source of everything the current route can
 * render (`visual-edit-source.ts`) and one `VisualChange`, and it answers with the
 * exact spans to rewrite — or refuses.
 *
 * ── THE THREE TIERS, IN ORDER ───────────────────────────────────────────────
 *
 *  1 · **THE BUILD TAG.** If the project was built with the template's source-tag
 *      loader, every element carries `data-tlm-loc="file:line:col"` and there is
 *      nothing to infer: the element IS that element. This is the only tier that can
 *      honestly be called exact, which is why the loader exists.
 *
 *  2 · **STRUCTURAL MATCHING.** For projects built before the loader (and for elements
 *      a component swallowed the attribute on), the element is identified by its
 *      *structure* rather than by string equality: tag, id, decoded text, the class
 *      tokens the source can prove, its ancestor chain, its siblings, and — decisively —
 *      whether the file is reachable from the route at all.
 *
 *  3 · **THE DATA BEHIND THE ELEMENT.** Generated projects put half their copy in
 *      arrays (`const features = [{ title: "…" }]`) rendered through `.map()`. The
 *      element's text is `{feature.title}` and matches nothing; the string the user
 *      edited lives in the array. Tier 3 goes and finds it.
 *
 * ── WHAT CHANGED ABOUT REFUSING ─────────────────────────────────────────────
 *
 * ⚠️⚠️ THE OLD SCORER REFUSED UNIQUE, CORRECT MATCHES, and that is most of what the
 * user saw. It required 45 points from a pool where a component file scored 0 for the
 * route and a merged class attribute scored 0 for the class — so an element that
 * appears exactly ONCE in the entire reachable source could be reported as
 * `low-confidence`. Uniqueness is now evidence in its own right: one structurally
 * consistent candidate in the files the route renders is not a guess.
 *
 * Ambiguity is still refused — but only after the tie-breakers below have had their
 * say, and after candidates that are the same source element have been collapsed.
 */

import {
    buildComponentIndex,
    classTokens,
    normalizeLinearText,
    normalizeText,
    parseSourceFile,
    reachableFromRoute,
    resolveImport,
    type ArrayEntry,
    type Declaration,
    type ParsedFile,
    type SourceElement,
    type ValueSpan,
} from "./visual-edit-source";
import type { ElementSignature, VisualChange } from "./visual-edit";

// ─── The project view ────────────────────────────────────────────────────────

export interface ProjectIndex {
    files: Map<string, ParsedFile>;
    /** `filePath::LocalName` → the file that name was imported from. */
    components: Map<string, string[]>;
    /** Route → file → import depth, memoised: one route is asked about many times. */
    reachability: Map<string, Map<string, number>>;
}

export function buildProjectIndex(files: Map<string, string>): ProjectIndex {
    const parsed = new Map<string, ParsedFile>();
    for (const [path, content] of files) parsed.set(path, parseSourceFile(path, content));
    return { files: parsed, components: buildComponentIndex(parsed), reachability: new Map() };
}

function reachabilityFor(index: ProjectIndex, route: string): Map<string, number> {
    const key = route || "/";
    const cached = index.reachability.get(key);
    if (cached) return cached;
    const computed = reachableFromRoute(index.files, key);
    index.reachability.set(key, computed);
    return computed;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * ⭐ THE WEIGHTS, AND WHY THEY ARE NOT THE OLD ONES.
 *
 * The old table was ported from the legacy Angular editor and scored *string presence
 * within 400 characters of an offset*. These score *structural agreement between two
 * trees*, so they are not comparable and were re-derived from the failure set:
 *
 *   · `id` is still near-proof and still worth more than anything else.
 *   · TEXT is now worth almost as much, because it is compared correctly (decoded,
 *     collapsed) instead of as a raw substring — a heading's text identifies it.
 *   · CLASS is worth less than it looks, because a real class attribute is a merge the
 *     source only partly explains. It is scored as a *containment ratio*, not a hit.
 *   · REACHABILITY replaces the old `route` weight and applies to every file the page
 *     renders, not only to `page.tsx`.
 */
const W = {
    exactLoc: 10000,
    id: 120,
    ownText: 90,
    subtreeText: 55,
    classFull: 70,
    classPartial: 35,
    ancestorChain: 45,
    parentTag: 12,
    parentClass: 22,
    sibling: 28,
    nthOfType: 14,
    attr: 26,
    tagExact: 18,
    reachableRoot: 45,
    reachableNear: 32,
    reachableFar: 18,
    unreachablePenalty: -55,
    componentTagPenalty: -8,
    loopPenalty: -6,
} as const;

/**
 * A candidate must clear this to be applied on its own. Roughly: "the text matched" or
 * "the id matched" or "the classes matched and the file is the one the route renders".
 */
export const ACCEPT_SCORE = 70;
/** A UNIQUE candidate — nothing else in the reachable source is consistent — clears this. */
export const ACCEPT_SCORE_UNIQUE = 28;
/** Two candidates closer than this are a tie, and a tie goes to the tie-breakers. */
export const TIE_MARGIN = 22;

export interface Match {
    element: SourceElement;
    score: number;
    reasons: string[];
    /** The element renders once per item — an edit here changes every rendered copy. */
    affectsMany: boolean;
}

export interface SignatureView {
    tag: string;
    id: string | null;
    ownText: string;
    subtreeText: string;
    tokens: string[];
    parentTag: string | null;
    parentTokens: string[];
    prevText: string;
    nextText: string;
    nthOfType: number;
    attrs: Record<string, string>;
    path: { tag: string; id: string | null; tokens: string[]; nthOfType: number }[];
    domOrdinal: number | null;
    domTwins: number | null;
}

function viewOf(signature: ElementSignature): SignatureView {
    return {
        tag: (signature.tag || "").toLowerCase(),
        id: signature.id || null,
        /**
         * ⚠️ G6 — `normalizeLinearText`, SO A `<br/>` SURVIVES AS A NEWLINE. The source
         * side assembles `<h1>Bean<br/>There</h1>` as `"Bean\nThere"`; flattening the
         * DOM's copy to `"Bean There"` here would make the two disagree by one character
         * and eliminate the only correct candidate. Identical to `normalizeText` for the
         * elements — nearly all of them — that contain no `<br/>`.
         */
        ownText: normalizeLinearText(signature.text),
        subtreeText: normalizeText(signature.subtreeText ?? signature.text),
        tokens: signature.classTokens?.length ? signature.classTokens : classTokens(signature.className),
        parentTag: signature.parentTag ? signature.parentTag.toLowerCase() : null,
        parentTokens: classTokens(signature.parentClassName),
        prevText: normalizeText(signature.prevSiblingText),
        nextText: normalizeText(signature.nextSiblingText),
        nthOfType: signature.nthOfType || 1,
        attrs: signature.attrs ?? {},
        path: signature.path ?? [],
        domOrdinal: typeof signature.domOrdinal === "number" ? signature.domOrdinal : null,
        domTwins: typeof signature.domTwins === "number" ? signature.domTwins : null,
    };
}

/**
 * How much of what the source promises is actually in the rendered class list?
 *
 * ⚠️ IT IS A RATIO, NOT A HIT, AND IT TOLERATES LOSS IN ONE DIRECTION ONLY. Everything
 * the source writes statically should appear in the DOM — except where `tailwind-merge`
 * dropped it as a conflict (`cn("px-4", "px-8")` renders only `px-8`), which is why the
 * bar is 70% rather than everything. The reverse direction is not checked at all: the
 * DOM legitimately holds tokens from `cva` variants, parent-supplied props and
 * `${font.className}` that no single source element can explain.
 */
function classAgreement(source: string[], dom: string[]): { ratio: number; matched: number } {
    if (source.length === 0) return { ratio: 0, matched: 0 };
    const set = new Set(dom);
    let matched = 0;
    for (const token of source) if (set.has(token)) matched++;
    return { ratio: matched / source.length, matched };
}

function ancestorTags(index: ProjectIndex, element: SourceElement): SourceElement[] {
    const file = index.files.get(element.filePath);
    const out: SourceElement[] = [];
    if (!file) return out;
    let current = element.parent;
    let guard = 0;
    while (current !== null && guard++ < 12) {
        const parent = file.elements[current];
        out.push(parent);
        current = parent.parent;
    }
    return out;
}

/**
 * Can a `className` written on this component's call site possibly reach the DOM?
 *
 * ⚠️ UNKNOWN IS "YES". A component imported from `next/image`, `framer-motion` or any
 * package is not in the file map, and the overwhelming majority of components in these
 * projects do forward. Guessing "no" would push the edit into a shared primitive and
 * restyle every instance in the app — a much worse mistake than writing a prop that turns
 * out to be ignored.
 */
function componentForwardsClassName(index: ProjectIndex, element: SourceElement): boolean {
    if (!element.isComponent) return true;
    // `motion.div`, `SheetPrimitive.Overlay` — a namespaced tag we cannot resolve.
    if (element.tag.includes(".")) return true;

    const own = index.files.get(element.filePath)?.components.get(element.tag);
    if (own) return own.forwardsClassName;

    for (const target of index.components.get(`${element.filePath}::${element.tag}`) ?? []) {
        const declared = index.files.get(target)?.components.get(element.tag);
        if (declared) return declared.forwardsClassName;
        // Imported under a different local name, or a default export: fall back to the
        // file's single component if it has exactly one.
        const components = index.files.get(target)?.components;
        if (components && components.size === 1) return [...components.values()][0].forwardsClassName;
    }

    return true;
}

function scoreElement(
    index: ProjectIndex,
    element: SourceElement,
    view: SignatureView,
    reachability: Map<string, number>,
    kind?: VisualChange["kind"]
): Match | null {
    const reasons: string[] = [];
    let score = 0;

    // ── Tag: the one hard gate, and it is deliberately loose for components ──
    if (element.domTag) {
        if (element.domTag !== view.tag) return null;
        score += W.tagExact;
        reasons.push("tag");
    } else {
        /**
         * ⭐ A COMPONENT IS A CANDIDATE FOR THE ELEMENT IT RENDERS, AND IT MUST BE.
         *
         * ⚠️ THE CALL SITE IS WHAT THE USER MEANT. `<Button variant="ghost">` renders a
         * `<button>` from `components/ui/button.tsx`; matching only the intrinsic
         * element would send every colour change into the shared primitive and repaint
         * every button in the app. So a component element competes for the DOM node,
         * and — because it is the more specific place to write — it is not penalised
         * out of contention.
         *
         * It has to bring its own evidence though: a bare `<Card />` with no class and
         * no text could otherwise match anything.
         */
        /**
         * ⚠️⚠️ AN IDENTIFYING ATTRIBUTE COUNTS EVEN WHEN ITS VALUE IS AN EXPRESSION, AND
         * LEAVING `href` OFF THIS LIST LOST EVERY NAVIGATION LINK.
         *
         * Measured on a page of real shapes: `<Link href={`/${item.toLowerCase()}`}>{item}</Link>`
         * inside a `.map()` has no static class, no static text and no id — so it brought
         * "no evidence", was struck from the pool before scoring, and the three nav links
         * it renders came back `ambiguous` against junk from unrelated files. A link is one
         * of the things people most obviously want to restyle.
         *
         * The attribute's PRESENCE is the evidence here, not its value: an element that
         * takes an `href` is a link, which is already enough to stop this matching a
         * `<Sonner>` or a `<CardTitle>`.
         */
        const IDENTIFYING = ["id", "alt", "src", "href", "title", "aria-label", "placeholder", "poster"];
        const hasEvidence =
            element.staticClassTokens.length > 0 ||
            element.ownText.length > 0 ||
            element.attrs.some(attr => IDENTIFYING.includes(attr.name));
        if (!hasEvidence) return null;

        /**
         * ⭐⭐⭐ A CLASS EDIT MUST NOT LAND WHERE REACT WILL THROW IT AWAY.
         *
         * ⚠️⚠️ THIS IS THE ONE FAILURE MODE WORSE THAN A REFUSAL: the file changes, the
         * rebuild runs, the credit is spent, the bar clears — and the page looks exactly
         * as it did. Measured on real shapes: `<Card title={…} body={…} />` where `Card`
         * never declares `className`. Excluding it lets the intrinsic `<article>` inside
         * the component win, which is the only edit that can move the pixels.
         */
        if (kind === "class" && !componentForwardsClassName(index, element)) return null;
        score += W.componentTagPenalty;
    }

    // ── Identity signals ────────────────────────────────────────────────────
    if (view.id && element.idValue === view.id) {
        score += W.id;
        reasons.push("id");
    } else if (view.id && element.idValue && element.idValue !== view.id) {
        // Two different ids is proof of the opposite.
        return null;
    }

    if (view.ownText && element.ownText && element.ownText === view.ownText) {
        score += W.ownText;
        reasons.push("text");
    } else if (view.subtreeText && element.subtreeText && sameText(element.subtreeText, view.subtreeText)) {
        score += W.subtreeText;
        reasons.push("subtree-text");
    } else if (view.ownText && element.ownText && !element.inLoop) {
        /**
         * Both sides have static text and they disagree — this is a different element.
         * ⚠️ NOT INSIDE A LOOP: there the source text is a placeholder for whatever the
         * data says, and disagreement means nothing.
         */
        const shared = element.ownText.length > 6 && view.ownText.includes(element.ownText);
        if (!shared) return null;
    } else if (
        /**
         * ⭐⭐ TEXT THAT DISAGREES IS PROOF OF THE NEGATIVE, AND IT IS WORTH MORE THAN
         * ANY POSITIVE SIGNAL HERE.
         *
         * ⚠️⚠️ MEASURED: a real privacy-policy page has fourteen `<li>` elements with no
         * class, no id and identical structure. Nothing distinguishes them except the
         * words inside — so without this rule every one of them scored identically and
         * all fourteen were refused as `ambiguous`, which is exactly what the user
         * reported. With it, thirteen candidates are eliminated outright and the
         * fourteenth is the answer.
         *
         * ⚠️ IT ONLY APPLIES WHEN THE SOURCE'S TEXT IS FULLY KNOWABLE. An element
         * containing `{title}` renders whatever the data says; disagreeing with it means
         * nothing, so `dynamicText` and `inLoop` are both excluded.
         */
        !element.dynamicText &&
        !element.inLoop &&
        element.subtreeText.length > 2 &&
        view.subtreeText.length > 2 &&
        !sameText(element.subtreeText, view.subtreeText)
    ) {
        return null;
    }

    // ── Class agreement ─────────────────────────────────────────────────────
    /**
     * ⭐⭐ A CLASSLESS ELEMENT CANNOT BE ONE THE SOURCE GIVES CLASSES TO.
     *
     * ⚠️⚠️ MEASURED: the template's own `page.tsx` is literally `<div></div>`, and it
     * was resolved to the layout's `<div className="min-h-screen flex flex-col">` — a
     * DIFFERENT FILE — because the class comparison only ran when BOTH sides had
     * classes, so the one signal that ruled the layout out was never consulted.
     *
     * ⚠️ UNCONDITIONAL TOKENS ONLY. `isActive && "bg-blue"` is allowed to be absent.
     * And a COMPONENT is exempt: `<Card className="p-4">` may drop, rename or override
     * what it is given, so its class list is a hint, never a promise.
     */
    if (
        view.tokens.length === 0 &&
        element.unconditionalClassTokens.length > 0 &&
        !element.isComponent &&
        !reasons.includes("id")
    ) {
        return null;
    }

    if (element.staticClassTokens.length > 0 && view.tokens.length > 0) {
        /**
         * ⭐⭐ THE DENOMINATOR IS THE UNCONDITIONAL TOKENS, AND USING ALL OF THEM WAS A
         * MEASURED BUG.
         *
         *     className={cn("rounded-2xl border border-stone-200 p-6 transition-shadow",
         *                   tone === "warm" && "bg-amber-50",
         *                   tone === "cool" && "bg-sky-50")}
         *
         * Six static tokens, four of which must render and two of which render only for a
         * `tone` nobody passed. Scored against all six the agreement was 4/6 = 0.67 — under
         * the 0.7 bar — so this element earned NO class points at all, lost to a `<Link>`
         * that merely happened to be in the same file, and the card came back `ambiguous`.
         *
         * A conditional token proves nothing by its absence, so it does not belong in the
         * denominator. It still counts when present, which is why `matched` is measured
         * over everything the source could contribute.
         */
        const required =
            element.unconditionalClassTokens.length > 0
                ? element.unconditionalClassTokens
                : element.staticClassTokens;
        const { ratio } = classAgreement(required, view.tokens);
        const { matched } = classAgreement(element.staticClassTokens, view.tokens);
        if (ratio >= 0.999) {
            score += W.classFull;
            reasons.push(`class:${matched}`);
        } else if (ratio >= 0.7) {
            score += W.classPartial;
            reasons.push(`class~${matched}`);
        } else if (ratio < 0.34 && !reasons.includes("id") && !reasons.includes("text")) {
            // The source says this element has classes the DOM does not — not it.
            return null;
        }
    }

    // ── The shape around it ─────────────────────────────────────────────────
    const ancestors = ancestorTags(index, element);
    const parent = ancestors[0];
    if (parent) {
        if (view.parentTag && parent.domTag === view.parentTag) {
            score += W.parentTag;
            reasons.push("parent-tag");
        }
        if (view.parentTokens.length > 0 && parent.staticClassTokens.length > 0) {
            // ⚠️ Unconditional only, for the reason above.
            const { ratio } = classAgreement(
                parent.unconditionalClassTokens.length > 0
                    ? parent.unconditionalClassTokens
                    : parent.staticClassTokens,
                view.parentTokens
            );
            if (ratio >= 0.7) {
                score += W.parentClass;
                reasons.push("parent-class");
            }
        }
    }

    /**
     * ⭐ THE ANCESTOR CHAIN — the signal that separates two identical cards that live in
     * different sections. The DOM chain is reported by the agent; the source chain is
     * whatever this file wraps the element in. They will not line up one-for-one
     * (components introduce DOM levels the file cannot see), so agreement is scored as
     * "how many of the source's ancestors appear, in order, in the DOM's chain".
     */
    if (view.path.length > 0 && ancestors.length > 0) {
        let cursor = 0;
        let hits = 0;
        for (const ancestor of ancestors) {
            if (!ancestor.domTag) continue;
            for (let i = cursor; i < view.path.length; i++) {
                const step = view.path[i];
                const tagOk = step.tag === ancestor.domTag;
                const idOk = ancestor.idValue ? step.id === ancestor.idValue : true;
                const classOk =
                    ancestor.unconditionalClassTokens.length === 0 ||
                    classAgreement(ancestor.unconditionalClassTokens, step.tokens).ratio >= 0.7;
                if (tagOk && idOk && classOk) {
                    hits++;
                    cursor = i + 1;
                    break;
                }
            }
        }
        if (hits > 0) {
            score += Math.min(W.ancestorChain, hits * 15);
            reasons.push(`chain:${hits}`);
        }
    }

    // Siblings, as the source can see them.
    if (parent) {
        const file = index.files.get(element.filePath);
        if (file) {
            const siblings = parent.children.map(childIndex => file.elements[childIndex]);
            const position = siblings.findIndex(sibling => sibling.index === element.index);
            const prev = position > 0 ? siblings[position - 1] : null;
            const next = position >= 0 && position < siblings.length - 1 ? siblings[position + 1] : null;
            const prevHit = prev && view.prevText && (prev.subtreeText === view.prevText || view.prevText.startsWith(prev.subtreeText) && prev.subtreeText.length > 3);
            const nextHit = next && view.nextText && (next.subtreeText === view.nextText || view.nextText.startsWith(next.subtreeText) && next.subtreeText.length > 3);
            if (prevHit || nextHit) {
                score += W.sibling;
                reasons.push("sibling");
            }
        }
    }

    if (element.nthOfType === view.nthOfType) {
        score += W.nthOfType;
        reasons.push("position");
    }

    // ── Attributes the DOM reported ─────────────────────────────────────────
    for (const name of ["alt", "href", "placeholder", "title", "aria-label", "type", "name"]) {
        const domValue = view.attrs[name];
        if (!domValue) continue;
        const attr = element.attrs.find(entry => entry.name === name || entry.name === camel(name));
        if (attr?.value && attr.value === domValue) {
            score += W.attr;
            reasons.push(`attr:${name}`);
            break;
        }
    }

    // ── Is this file even on screen? ────────────────────────────────────────
    const depth = reachability.get(element.filePath);
    if (depth === undefined) {
        score += W.unreachablePenalty;
        reasons.push("unreachable");
    } else if (depth === 0) {
        score += W.reachableRoot;
        reasons.push("route");
    } else if (depth <= 2) {
        score += W.reachableNear;
        reasons.push(`route+${depth}`);
    } else {
        score += W.reachableFar;
        reasons.push(`route+${depth}`);
    }

    if (element.inLoop) score += W.loopPenalty;

    return { element, score, reasons, affectsMany: element.inLoop };
}

/**
 * Text equality, tolerant of the one thing the agent legitimately changes: it caps the
 * reported `textContent` at 300 characters, so a long paragraph arrives truncated.
 */
function sameText(source: string, dom: string): boolean {
    if (source === dom) return true;
    /**
     * ⚠️ THE THRESHOLD IS DELIBERATELY NOT `=== 300`. The agent truncates at 300 and the
     * value is then trimmed, so a cut landing on a space arrives 299 characters long —
     * and an exact-length test therefore fell through to strict equality and DISQUALIFIED
     * the one correct candidate. Measured on a real page: a `<section>` whose text ran to
     * 506 characters was eliminated by a one-character difference in a cap we imposed
     * ourselves.
     */
    if (dom.length >= 240 && source.length > dom.length && source.startsWith(dom.slice(0, dom.length - 10))) {
        return true;
    }
    return false;
}

/**
 * Do these two Tailwind utilities set the same property, so that one can stand exactly
 * where the other did?
 *
 * ⚠️ `text-2xl` AND `text-slate-900` SHARE A PREFIX AND ARE NOT THE SAME FAMILY. `text-`
 * is overloaded — size, colour, alignment and wrapping all live under it — so the prefix
 * alone would swap a colour into the slot a size vacated and leave the element both
 * uncoloured and unsized. The size grammar is what separates them.
 */
const UTILITY_PREFIXES = ["text", "bg", "border", "font", "ring", "fill", "stroke", "decoration", "from", "via", "to", "shadow"];
const SIZE_VALUE = /^(xs|sm|base|lg|xl|\d?xl|\[\d*\.?\d+(rem|px|em|pt)\])$/;

function utilityFamily(token: string): string | null {
    // A variant (`hover:`, `md:`) is a different state and is never substituted.
    if (token.includes(":")) return null;
    const prefix = UTILITY_PREFIXES.find(candidate => token.startsWith(`${candidate}-`));
    if (!prefix) return null;
    const value = token.slice(prefix.length + 1);
    if (!value) return null;
    if (prefix === "text") return SIZE_VALUE.test(value) ? "text:size" : "text:colour";
    return prefix;
}

function sameUtilityFamily(removed: string, added: string): boolean {
    const family = utilityFamily(removed);
    return family !== null && family === utilityFamily(added);
}

function camel(name: string): string {
    return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

// ─── Tier 1: the build tag ───────────────────────────────────────────────────

/**
 * ⭐⭐⭐ `data-tlm-loc="src/app/page.tsx:42:7"` — WRITTEN BY THE BUILD, SO THERE IS
 * NOTHING TO GUESS.
 *
 * The template's webpack loader stamps every JSX element with the file, line and
 * column it was written at. When the preview carries them, matching is a lookup and
 * every failure mode above disappears: merged classes, interpolated fonts, repeated
 * cards, `.map()`, entities, components — none of them matter, because the element is
 * named rather than described.
 *
 * ⚠️ THE CALL SITE WINS OVER THE PRIMITIVE, BY CONSTRUCTION. `<Button className="…">`
 * puts its own `data-tlm-loc` in `props`, and shadcn-style components spread `{...props}`
 * after their own attributes — so the attribute that survives onto the DOM node is the
 * one from the file the user actually wants to edit. When a component does NOT forward
 * props the inner element's tag survives instead, which is still correct, just shared.
 */
/**
 * ⭐⭐⭐ G6 — A BUILD TAG IS EVIDENCE, NOT AN ORACLE, AND TREATING IT AS ONE WROTE TO
 * THE WRONG ELEMENT.
 *
 * ⚠️⚠️ THE STAMP DESCRIBES THE BUILD THE PREVIEW IS SERVING; WE MATCH IT AGAINST THE
 * FILES AS THEY ARE NOW, AND THOSE TWO ARE NOT THE SAME THING. The chat agent writes
 * source and the preview keeps serving the previous build until its rebuild lands; an
 * apply that fails part-way leaves files ahead of the running app. Any of that shifts
 * line numbers, and `file:line:col` then names *whatever element now sits there*.
 *
 * ⚠️ MEASURED, 2026-08-13. Shift a real page by a single line and re-resolve every
 * stamp on it:
 *
 *     media/page.tsx  +1 line → 23 elements:  5 WRONG ELEMENT, 18 safely-null
 *     hard/page.tsx   +1 line → 33 elements:  8 WRONG ELEMENT, 25 safely-null
 *     login/page.tsx  +1 line → 26 elements:  4 WRONG ELEMENT, 22 safely-null
 *
 * 15–24% resolved to a DIFFERENT element — and came back with `score: 10000` and
 * `reasons: ["source-tag"]`, the highest confidence the system can express. The edit
 * landed, the credit was spent, the bar cleared, and something the user never touched
 * changed.
 *
 * So the stamp now has to AGREE with what the agent saw. The three cheap checks below
 * are enough to catch a shift: a wrong element is almost never the same tag with the
 * same id and the same static classes.
 *
 * ⚠️ IT IS DELIBERATELY LENIENT ABOUT WHAT THE SOURCE CANNOT PROMISE. A component
 * renders a tag the file does not name, `cn()` merges classes the file only partly
 * owns, and a `.map()` template's text is a placeholder — none of those disagreements
 * mean the stamp is stale, and rejecting them would throw away the exact tier for the
 * very projects it was built for. Only a positive contradiction refuses.
 */
function tagAgreesWithSignature(
    index: ProjectIndex,
    element: SourceElement,
    signature: ElementSignature
): boolean {
    // 1 · The tag. Only checked when the source knows it — a component may render anything.
    if (element.domTag && signature.tag && element.domTag !== signature.tag.toLowerCase()) return false;

    // 2 · The id. Two different ids is proof of the opposite, in either direction.
    const domId = signature.id || null;
    if (element.idValue && domId && element.idValue !== domId) return false;

    // 3 · The classes the source says are unconditional. A component is exempt (it may
    //     rename or drop what it is given) and so is an element the source gives none.
    const required = element.unconditionalClassTokens;
    if (!element.isComponent && required.length > 0) {
        const dom = signature.classTokens?.length ? signature.classTokens : classTokens(signature.className);
        // No class attribute at all in the DOM, but the source guarantees some: not it.
        if (dom.length === 0) return false;
        if (classAgreement(required, dom).ratio < 0.7) return false;
    }

    /**
     * 4 · ⭐⭐ THE TEXT, WHEN THE SOURCE FULLY KNOWS IT — AND THIS CHECK EARNS ITS PLACE.
     *
     * ⚠️⚠️ TAG AND CLASSES ALONE ARE NOT ENOUGH ON A PAGE OF LOOK-ALIKES. A list of
     * `<li className="text-sm text-stone-500">` items, three nav links, fourteen policy
     * bullets: a drifted stamp landing on the WRONG one of those agrees on tag, on id
     * (neither has one) and on every class. Measured while building this — `STALE=1`
     * left `exact 8`, eight stamps believed across a drift, and the text planner will
     * now happily rewrite a located element's only text run whatever `before` said. The
     * two changes are individually safe and dangerous together.
     *
     * Words are what separate those elements, so words are what has to agree.
     *
     * ⚠️ ONLY WHEN THE SOURCE CAN BE HELD TO IT. `{title}` renders whatever the data
     * says and a `.map()` template's text is a placeholder for N different strings —
     * disagreeing with either proves nothing, and refusing on it would throw away the
     * exact tier for every list on the page.
     */
    /**
     * ⚠️ AN ID THAT MATCHES OUTRANKS TEXT THAT DOES NOT, and the two rules would
     * otherwise cancel each other out. `id="intro"` on both sides is near-proof of
     * identity — ids are unique in a document and survive every rewrite — so a text
     * disagreement on top of it does not mean "wrong element", it means the preview is a
     * build behind. That is precisely the case the text planner's relaxed single-run
     * write exists to serve; disqualifying here would refuse it and the two changes
     * would net to nothing.
     */
    const idConfirmed = Boolean(element.idValue && domId && element.idValue === domId);

    const domText = normalizeText(signature.subtreeText ?? signature.text);
    if (
        !idConfirmed &&
        !element.dynamicText &&
        !element.inLoop &&
        element.subtreeText.length > 2 &&
        domText.length > 2 &&
        !sameText(element.subtreeText, domText)
    ) {
        return false;
    }

    return true;
}

export function findByLoc(index: ProjectIndex, loc: string | null | undefined): SourceElement | null {
    if (!loc) return null;
    const match = /^(.*):(\d+):(\d+)$/.exec(loc.trim());
    if (!match) return null;
    const [, rawPath, rawLine, rawColumn] = match;
    const line = Number(rawLine);
    const column = Number(rawColumn);

    const file = index.files.get(rawPath) ?? index.files.get(rawPath.replace(/^\.\//, ""));
    if (!file) return null;

    let best: SourceElement | null = null;
    for (const element of file.elements) {
        if (element.line !== line) continue;
        if (element.column === column) return element;
        // Tolerate a one-character drift rather than failing to an inferior tier.
        if (Math.abs(element.column - column) <= 1) best = element;
    }
    return best;
}

// ─── The public entry point ──────────────────────────────────────────────────

export interface Located {
    element: SourceElement;
    score: number;
    reasons: string[];
    affectsMany: boolean;
    exact: boolean;
}

export type LocateFailure = "not-found" | "ambiguous" | "low-confidence";

/**
 * Every structurally consistent candidate, best first.
 *
 * ⚠️ EXPORTED SO A FAILURE CAN BE EXPLAINED. When a change comes back `ambiguous` the
 * only useful question is "ambiguous with WHAT", and answering it from the outside
 * meant re-implementing the scorer. `.tmp`-style probes and the accuracy harness call
 * this directly; the resolver itself only ever uses `locateElement`.
 */
export function rankMatches(
    index: ProjectIndex,
    signature: ElementSignature,
    precomputed?: SignatureView,
    kind?: VisualChange["kind"]
): Match[] {
    const view = precomputed ?? viewOf(signature);
    const reachability = reachabilityFor(index, signature.route);

    const matches: Match[] = [];
    for (const file of index.files.values()) {
        for (const element of file.elements) {
            const scored = scoreElement(index, element, view, reachability, kind);
            if (scored) matches.push(scored);
        }
    }
    /**
     * ⭐⭐ A FILE THE ROUTE CANNOT RENDER IS NOT A WEAK ANSWER, IT IS NOT AN ANSWER.
     *
     * ⚠️⚠️ AN UNREACHABLE FILE USED TO BE A −55 PENALTY, AND THAT TURNED HONEST MISSES
     * INTO `ambiguous`. Measured: the pool for a nav link was five components from
     * `profile/page.tsx` and `components/ui/*` scoring −34 and −49 — none of them
     * reachable from the route, all of them tied with each other. The user was told "it
     * appears in several places and we can't tell which you meant" about an element that
     * matched NOTHING findable. "Ambiguous" invites the user to disambiguate; there was
     * nothing to disambiguate.
     *
     * ⚠️ ONLY WHEN A REACHABLE CANDIDATE EXISTS. Reachability is computed from the import
     * graph and can legitimately come up empty — an unrecognised route shape, a dynamic
     * import it cannot follow. In that case every candidate is "unreachable" and dropping
     * them all would break the match rather than sharpen it, so the filter stands down.
     */
    const reachable = matches.filter(match => reachability.has(match.element.filePath));
    const pool = reachable.length > 0 ? reachable : matches;

    /**
     * A candidate scoring below zero has been contradicted more than it has been
     * supported. Keeping it can only mislead the tie-breakers.
     */
    const credible = pool.filter(match => match.score > 0);
    const finalists = (credible.length > 0 ? credible : pool).sort((a, b) => b.score - a.score);

    /**
     * ⚠️ A COMPONENT AND THE ELEMENT IT RENDERS ARE NOT TWO ANSWERS. When both
     * `<Button className="…">` in the page and `<button className={cn(…)}>` in
     * `ui/button.tsx` match, the page is the right place to write and the primitive is
     * the wrong one — treating that as ambiguity would refuse a change the user could
     * not possibly have meant any other way.
     */
    return dropSharedPrimitives(finalists, reachability);
}

export function locateElement(
    index: ProjectIndex,
    signature: ElementSignature,
    /**
     * What is being changed. Only used to rule out a component call site that cannot
     * carry a `className` — see the note in `scoreElement`.
     */
    kind?: VisualChange["kind"]
): { ok: true; match: Located } | { ok: false; reason: LocateFailure; occurrences: number } {
    // ── Tier 1 ──────────────────────────────────────────────────────────────
    const tagged = findByLoc(index, signature.loc);
    /**
     * ⚠️ `tagAgreesWithSignature` IS WHAT MAKES THIS TIER SAFE — see its note. A stamp
     * that contradicts what the agent saw means the preview is a build behind, and the
     * honest thing is to fall through to inference (which compares everything) rather
     * than to write at maximum confidence into an element nobody clicked.
     */
    if (
        tagged &&
        tagAgreesWithSignature(index, tagged, signature) &&
        !(kind === "class" && !componentForwardsClassName(index, tagged))
    ) {
        return {
            ok: true,
            match: { element: tagged, score: W.exactLoc, reasons: ["source-tag"], affectsMany: tagged.inLoop, exact: true },
        };
    }

    // ── Tier 2 ──────────────────────────────────────────────────────────────
    const view = viewOf(signature);
    const filtered = rankMatches(index, signature, view, kind);

    if (filtered.length === 0) return { ok: false, reason: "not-found", occurrences: 0 };

    const [best, second] = filtered;

    const decisive =
        best.reasons.includes("id") ||
        best.reasons.includes("text") ||
        best.reasons.includes("subtree-text") ||
        best.reasons.some(reason => reason.startsWith("attr:"));

    if (filtered.length === 1) {
        /**
         * ⭐⭐ ONE CANDIDATE IS NOT A GUESS, AND THIS IS THE FIX FOR `low-confidence`.
         * Nothing else in any file the route renders is structurally consistent with
         * what the user clicked. A lower bar here is not a weaker standard — the
         * evidence is the absence of an alternative.
         */
        if (best.score >= ACCEPT_SCORE_UNIQUE) return accept(best);
        return { ok: false, reason: "low-confidence", occurrences: 1 };
    }

    if (best.score - second.score >= TIE_MARGIN && best.score >= ACCEPT_SCORE_UNIQUE) return accept(best);

    /**
     * ⭐ THE ORDINAL TIE-BREAK. Three identical cards in the source and three identical
     * cards on screen is not ambiguity — it is a list, and the agent counted which one
     * the user clicked. Only applied when the counts line up exactly, because that is
     * what proves the two sets are the same set.
     */
    const tied = filtered.filter(candidate => best.score - candidate.score < TIE_MARGIN);
    if (view.domOrdinal !== null && view.domTwins === tied.length && view.domOrdinal < tied.length) {
        const ordered = [...tied].sort(
            (a, b) => a.element.filePath.localeCompare(b.element.filePath) || a.element.order - b.element.order
        );
        return accept(ordered[view.domOrdinal]);
    }

    if (decisive && best.score >= ACCEPT_SCORE && best.score > second.score) return accept(best);

    return { ok: false, reason: "ambiguous", occurrences: tied.length };
}

function accept(match: Match): { ok: true; match: Located } {
    return { ok: true, match: { ...match, exact: false } };
}

/**
 * Remove candidates that are the shared primitive behind a better, more specific
 * candidate: same DOM tag, deeper in the import graph, and no unique evidence of its
 * own. `components/ui/*` is the canonical case.
 */
function dropSharedPrimitives(matches: Match[], reachability: Map<string, number>): Match[] {
    if (matches.length < 2) return matches;
    const best = matches[0];
    const bestDepth = reachability.get(best.element.filePath) ?? 99;

    return matches.filter((candidate, position) => {
        if (position === 0) return true;
        const depth = reachability.get(candidate.element.filePath) ?? 99;
        const isPrimitive = /(^|\/)components\/ui\//.test(candidate.element.filePath);
        if (isPrimitive && depth > bestDepth) return false;
        // The same file, an ancestor/descendant pair: keep only the one that scored best.
        if (
            candidate.element.filePath === best.element.filePath &&
            (candidate.element.start <= best.element.start && candidate.element.end >= best.element.end)
        ) {
            return false;
        }
        return true;
    });
}

// ─── Planning the actual characters to write ─────────────────────────────────

export interface SpanEdit {
    filePath: string;
    index: number;
    before: string;
    after: string;
}

export type PlanFailure = "not-found" | "ambiguous" | "low-confidence" | "unsupported";

export function planEdit(
    index: ProjectIndex,
    change: VisualChange,
    match: Located
): { ok: true; edits: SpanEdit[] } | { ok: false; reason: PlanFailure } {
    if (change.kind === "text") return planTextEdit(index, change, match.element);
    if (change.kind === "class") return planClassEdit(index, change, match.element);
    return planSrcEdit(index, change, match.element);
}

// ── Text ────────────────────────────────────────────────────────────────────

/**
 * ⚠️ WHAT GETS WRITTEN IS JSX TEXT, NOT A STRING. `<` and `{` are syntax there, so a
 * heading containing either is written as an expression (`{"a < b"}`) instead of being
 * pasted in raw and breaking the build. Everything else is written literally —
 * including apostrophes, because `react/no-unescaped-entities` is a lint rule and the
 * template disables lint during builds.
 */
function jsxTextLiteral(value: string): string {
    if (/[<>{}]/.test(value)) return `{${JSON.stringify(value)}}`;
    return value;
}

function planTextEdit(
    index: ProjectIndex,
    change: VisualChange,
    element: SourceElement
): { ok: true; edits: SpanEdit[] } | { ok: false; reason: PlanFailure } {
    const file = index.files.get(element.filePath);
    if (!file) return { ok: false, reason: "not-found" };

    // ⚠️ G6 — LINEAR, so a `<br/>` in the user's text stays a line break rather than
    // collapsing into a space. Identical to `normalizeText` when there is no `<br/>`.
    const before = normalizeLinearText(change.before);
    const after = change.after;
    const slots = element.texts;

    /**
     * ⚠️ THE FILE MAY ALREADY SAY IT. The element was identified independently of the
     * change's `before` value, so "found, and nothing to write" is a real outcome — a
     * second apply of the same edit, or one the agent wrote before a rebuild landed.
     * An empty plan is reported as SATISFIED upstream, not as a failure.
     */
    if (element.ownText && element.ownText === normalizeLinearText(after)) return { ok: true, edits: [] };

    /**
     * ⭐⭐ G6 — A HEADING BROKEN OVER SEVERAL LINES BY `<br/>`.
     *
     * ⚠️⚠️ `<h1>Bean<br/>There</h1>` COULD NOT BE EDITED AT ALL before this — the panel
     * offered no text field and the page took no caret, because `isEditableText` refused
     * any element with children. A hero heading split over two lines is one of the most
     * common things on a generated landing page and one of the most likely things a user
     * wants to retype, so the refusal was landing on exactly the wrong element.
     *
     * The element's text is LINEAR (a `<br>` holds no content), so it maps one-to-one
     * onto the JSX text runs between the `<br/>`s: line 1 → run 1, line 2 → run 2.
     *
     * ⚠️ EQUAL COUNTS ONLY, AND THAT IS A REFUSAL WORTH KEEPING. Typing a new line break
     * in, or deleting one, means ADDING or REMOVING a `<br/>` element — restructuring the
     * markup rather than rewriting a string, and the kind of edit that is much better
     * asked of the chat than guessed at here.
     */
    if (element.brOnly && slots.length > 0) {
        const lines = normalizeLinearText(after).split("\n");
        if (lines.length !== slots.length) return { ok: false, reason: "unsupported" };
        const edits = slots
            .map((slot, position) => ({ slot, line: lines[position] }))
            .filter(entry => entry.slot.value !== entry.line)
            .map(entry => replaceTextSlot(element, entry.slot, entry.line));
        return { ok: true, edits };
    }

    if (slots.length === 0) {
        /**
         * The text is `{something}` — tier 3 (the data behind a `.map()`) is what
         * handles this, and the resolver runs it next.
         *
         * ⭐ G6 — `unsupported`, NOT `not-found`, AND THE DIFFERENCE IS WHO GETS IT NEXT.
         * We know exactly which element this is; its text is simply not written in the
         * markup. `not-found` sent it on to the legacy matcher, which searches the raw
         * file for the old string and rewrites wherever it lands — the same demotion
         * that put an image edit into an unrelated `<picture>`. Tier 3 still runs first
         * either way; this only changes what happens when tier 3 also comes up empty.
         */
        return { ok: false, reason: "unsupported" };
    }

    // 1 · The ordinary case: one text node, and it says what the user was looking at.
    const whole = slots.find(slot => slot.value === before);
    if (whole) return { ok: true, edits: [replaceTextSlot(element, whole, after)] };

    /**
     * 2 · ⭐⭐ G6 — THE ELEMENT'S WHOLE TEXT IS THIS ONE RUN, SO WRITE IT, WHATEVER
     *     `before` CLAIMS.
     *
     * ⚠️ THE OLD GUARD WAS `only.value === before`, AND IT REFUSED CORRECT EDITS. The
     * element has one static text run, no element children and no interpolation — its
     * rendered text IS that run, and we identified the element independently of the
     * change. So a `before` that disagrees does not mean "wrong element", it means the
     * value the browser reported is not what the file says: the preview is a build
     * behind, the agent truncated a long paragraph at 300 characters, or an earlier edit
     * in the batch drifted it. In every one of those the right answer is the same, and
     * it is the one the user asked for.
     *
     * ⚠️ THE THREE CONDITIONS ARE ALL LOAD-BEARING. With an interpolation
     * (`Hello {name}!`) or an element child, the run is only PART of the rendered text
     * and overwriting it with the whole string would swallow the rest — which is what
     * case 3 below exists to do properly.
     */
    if (slots.length === 1 && !element.hasElementChildren && !element.dynamicText) {
        return { ok: true, edits: [replaceTextSlot(element, slots[0], after)] };
    }

    /**
     * 3 · ⭐ AN EDIT INSIDE INTERPOLATED TEXT. `<p>Welcome back, {name}!</p>` renders
     * "Welcome back, Ada!"; the user retypes the greeting and the change's `before`
     * contains a value that is in no file. Comparing before/after only where they
     * DIFFER isolates the part the user actually touched, and that part has to fall
     * inside exactly one static run for this to be safe.
     */
    const diff = diffSegment(before, normalizeText(after));
    if (diff) {
        const owners = slots.filter(slot => diff.removed && slot.value.includes(diff.removed));
        if (owners.length === 1 && diff.removed) {
            const slot = owners[0];
            const updated = slot.value.replace(diff.removed, diff.added);
            return { ok: true, edits: [replaceTextSlot(element, slot, updated)] };
        }
    }

    /**
     * ⭐ G6 — WHICH REFUSAL THIS IS DEPENDS ON WHETHER THE SOURCE COULD HAVE ANSWERED.
     *
     * ⚠️ WHEN THE ELEMENT'S TEXT IS FULLY STATIC AND STILL DOES NOT LINE UP, A BLIND
     * TEXT SEARCH IS THE LAST THING THAT SHOULD RUN. We located the element and read
     * every one of its text runs; if the user's `before` is in none of them, the file
     * simply does not say what the browser said. Handing that to the legacy matcher —
     * "go and find this sentence anywhere in the project" — is how an edit lands on a
     * different element that happens to share a phrase.
     *
     * An element whose text is partly computed is the opposite case: the source
     * genuinely cannot know, so the older matcher is still allowed its attempt.
     */
    if (!element.dynamicText) return { ok: false, reason: "unsupported" };

    return { ok: false, reason: "not-found" };
}

function replaceTextSlot(element: SourceElement, slot: { start: number; end: number; raw: string; kind: "jsx" | "string" }, value: string): SpanEdit {
    if (slot.kind === "string") {
        // Inside `{"…"}` — write a JS string body, escaped for the quote that is there.
        return {
            filePath: element.filePath,
            index: slot.start,
            before: slot.raw,
            after: JSON.stringify(value).slice(1, -1),
        };
    }
    // Keep the author's indentation: only the meaningful middle of the run is replaced.
    const leading = /^\s*/.exec(slot.raw)![0];
    const trailing = /\s*$/.exec(slot.raw.slice(leading.length))![0];
    return {
        filePath: element.filePath,
        index: slot.start,
        before: slot.raw,
        after: `${leading}${jsxTextLiteral(value)}${trailing}`,
    };
}

/** The one contiguous region where two strings differ, ignoring the shared ends. */
function diffSegment(before: string, after: string): { removed: string; added: string } | null {
    if (before === after) return null;
    let start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start++;
    let end = 0;
    while (
        end < before.length - start &&
        end < after.length - start &&
        before[before.length - 1 - end] === after[after.length - 1 - end]
    ) {
        end++;
    }
    const removed = before.slice(start, before.length - end);
    const added = after.slice(start, after.length - end);
    if (!removed) return null;
    return { removed, added };
}

// ── Class ───────────────────────────────────────────────────────────────────

/**
 * ⭐⭐ A CLASS EDIT IS A TOKEN DELTA, NOT A STRING REPLACEMENT.
 *
 * ⚠️⚠️ THIS IS THE OTHER HALF OF THE `not-found` FIX. The old code searched for the
 * element's whole rendered class list as a literal attribute value — a string that, on
 * a project using `cn()`, a `cva` component or a `${font.className}` template, exists
 * nowhere. But the user did not change a string: they removed `text-stone-900` and
 * added `text-[#cf5230]`. Those two tokens are all that has to be found, and the
 * removed one is usually right there in a literal the source does own.
 *
 * ⚠️ A TOKEN WE CANNOT FIND IS NOT AN ERROR. It came from a `cva` variant, a parent's
 * prop or a helper — none of which this element may rewrite. The new token is appended
 * at the call site instead, where `tailwind-merge` resolves the conflict in its favour.
 */
function planClassEdit(
    index: ProjectIndex,
    change: VisualChange,
    element: SourceElement
): { ok: true; edits: SpanEdit[] } | { ok: false; reason: PlanFailure } {
    const file = index.files.get(element.filePath);
    if (!file) return { ok: false, reason: "not-found" };

    const beforeTokens = classTokens(change.before);
    const afterTokens = classTokens(change.after);
    const beforeSet = new Set(beforeTokens);
    const afterSet = new Set(afterTokens);

    const removed = beforeTokens.filter(token => !afterSet.has(token));
    /**
     * ⚠️ A TOKEN THE SOURCE ALREADY HAS IS NOT AN ADDITION. Without this, applying the
     * same colour twice — or applying one the agent had already written before a
     * rebuild — would append a duplicate class on every attempt, and the attribute
     * would grow by one token per click.
     */
    const present = new Set(element.staticClassTokens);
    const added = afterTokens.filter(token => !beforeSet.has(token) && !present.has(token));

    if (removed.length === 0 && added.length === 0) return { ok: true, edits: [] };

    /** slot index → the tokens that slot should hold after the edit. */
    const rewritten = new Map<number, string[]>();
    const slotOf = (position: number) => element.classSlots.findIndex(slot => slot.end === position);

    /**
     * ⭐ SUBSTITUTE IN PLACE WHERE THE TOKENS ARE THE SAME KIND OF THING.
     *
     * A colour change is `text-slate-900` → `text-[#cf5230]`, and a size change is
     * `text-2xl` → `text-3xl`. Removing one and appending the other is functionally
     * identical — Tailwind does not care where in the attribute a utility sits — but it
     * turns every edit into a reshuffle of the user's class list, and after two edits the
     * attribute no longer resembles what they wrote. Their git diff is the thing being
     * damaged, so pair the tokens up and swap them where they stand.
     */
    const pendingAdds = [...added];
    const appendOnly: string[] = [];

    for (const token of removed) {
        const slotIndex = element.classSlots.findIndex(
            (slot, position) => (rewritten.get(position) ?? slot.tokens).includes(token)
        );
        if (slotIndex === -1) continue; // Not ours to remove — see the note above.
        const slot = element.classSlots[slotIndex];
        const current = rewritten.get(slotIndex) ?? [...slot.tokens];

        const replacementIndex = pendingAdds.findIndex(candidate => sameUtilityFamily(token, candidate));
        if (replacementIndex !== -1) {
            const replacement = pendingAdds.splice(replacementIndex, 1)[0];
            rewritten.set(
                slotIndex,
                current.map(entry => (entry === token ? replacement : entry))
            );
            continue;
        }
        rewritten.set(slotIndex, current.filter(entry => entry !== token));
    }
    appendOnly.push(...pendingAdds);

    const edits: SpanEdit[] = [];
    let appendHandled = appendOnly.length === 0;

    // Where the new tokens go, when they can go into a literal we are already touching.
    const append = element.classAppend;
    if (!appendHandled && append?.kind === "slot") {
        const slotIndex = slotOf(append.at);
        if (slotIndex !== -1) {
            const slot = element.classSlots[slotIndex];
            const current = rewritten.get(slotIndex) ?? [...slot.tokens];
            rewritten.set(slotIndex, [...current, ...appendOnly]);
            appendHandled = true;
        }
    }

    for (const [slotIndex, tokens] of rewritten) {
        const slot = element.classSlots[slotIndex];
        const next = tokens.join(" ");
        if (next === slot.text) continue;
        /**
         * ⚠️ THE RUN'S OWN WHITESPACE IS PRESERVED. A template literal's static run is
         * often written across several lines; collapsing it to one line would be a
         * diff the user did not ask for, and in `` `a ${x} b` `` the spaces around the
         * interpolation are load-bearing — without them the tokens would fuse.
         */
        const leading = /^\s*/.exec(slot.text)![0];
        const trailing = /\s*$/.exec(slot.text.slice(leading.length))![0];
        edits.push({
            filePath: element.filePath,
            index: slot.start,
            before: slot.text,
            after: next ? `${leading}${next}${trailing}` : leading || trailing || "",
        });
    }

    if (!appendHandled && appendOnly.length > 0) {
        const addition = appendOnly.join(" ");
        if (!append) return { ok: false, reason: "unsupported" };
        if (append.kind === "call") {
            edits.push({ filePath: element.filePath, index: append.at, before: "", after: `, "${addition}"` });
        } else if (append.kind === "wrap") {
            const expression = file.content.slice(append.exprStart, append.exprEnd);
            edits.push({
                filePath: element.filePath,
                index: append.exprStart,
                before: expression,
                after: `\`\${${expression}} ${addition}\``,
            });
        } else if (append.kind === "attribute") {
            edits.push({
                filePath: element.filePath,
                index: append.at,
                before: "",
                after: ` className="${addition}"`,
            });
        } else {
            return { ok: false, reason: "unsupported" };
        }
    }

    /**
     * ⚠️ NOTHING TO WRITE IS "ALREADY TRUE", NOT "COULD NOT FIND IT". Every token the
     * user wanted added is in the source already and every token they removed was never
     * the source's to remove (it came from a `cva` variant or a parent's prop). The
     * batch reports this as satisfied, which is what the user sees on screen.
     */
    return { ok: true, edits };
}

// ── src ─────────────────────────────────────────────────────────────────────

/**
 * The attributes that carry a media url, in the order we prefer to rewrite them.
 *
 * ⭐ G6 — `srcSet` IS HERE BECAUSE `<picture><source srcSet="…">` HAS NO `src` AT ALL,
 * and the panel offered to replace it anyway (the agent reports `<source>` as media).
 * The change was then handed to the text matcher, which is how an unrelated element got
 * rewritten. A `<source>` is one of the two ordinary ways to put a picture on a page.
 */
const MEDIA_ATTRS = ["src", "srcSet", "srcset", "poster"];

function planSrcEdit(
    index: ProjectIndex,
    change: VisualChange,
    element: SourceElement
): { ok: true; edits: SpanEdit[] } | { ok: false; reason: PlanFailure } {
    const file = index.files.get(element.filePath);
    if (!file) return { ok: false, reason: "not-found" };

    const attr = element.attrs.find(entry => MEDIA_ATTRS.includes(entry.name));
    if (!attr) return { ok: false, reason: "not-found" };

    if (attr.value !== null && attr.valueStart >= 0) {
        return {
            ok: true,
            edits: [
                {
                    filePath: element.filePath,
                    index: attr.valueStart,
                    before: file.content.slice(attr.valueStart, attr.valueEnd),
                    after: change.after,
                },
            ],
        };
    }

    /**
     * ⭐ `src={files.beanThereHero}` — RECORDED IN THE AUDIT AS "NOT FIXED, AND WHY".
     *
     * The URL lives in a `.ts` module, which the old matcher never read, and the
     * attribute is an expression, which it could not have matched anyway. Following the
     * identifier to its declaration — in this file or in one it imports — is a bounded,
     * unambiguous lookup: there is exactly one constant with that name.
     */
    /**
     * ⭐ A DOTTED PATH OF ANY DEPTH, NOT JUST `a` OR `a.b`.
     *
     * ⚠️ `src={SITE.hero.image}` WAS REFUSED BY THIS TEST ALONE. Generated projects hold
     * their copy in the shape of the page (`{ hero: { image } }`), so two dots is the
     * common case, not an exotic one — and the refusal it produced told the user the url
     * was "built by your code", about a url written plainly in a data file. The source
     * model now records nested paths verbatim, so the whole path is looked up as written.
     *
     * Anything that is not a plain path — a template literal, a ternary, a call — is
     * still refused: those genuinely compute a value, and that is what the message says.
     */
    const expression = (attr.expressionText || "").trim();
    if (!expression || !/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(expression)) {
        return { ok: false, reason: "unsupported" };
    }

    /**
     * ⭐⭐ G6 — THE URL IS IN THE LOOP'S DATA, AND `domOrdinal` SAYS WHICH ENTRY.
     *
     * ⚠️⚠️ THIS IS THE FIX FOR THE WORST BUG THE AUDIT FOUND. `<img src={item.src}>`
     * inside `gallery.map(item => …)` is ONE source element rendering N images. The
     * planner had no way to write it, the change fell through to the legacy text
     * matcher, and that searched the file for "/g1.png" and rewrote a `<source srcSet>`
     * in an unrelated `<picture>` forty lines away — reported as applied.
     *
     * There is nothing to guess here. `loop.iterable` names the array, `loop.param`
     * names the item, `item.src` says which property, and the agent already counted
     * which of the identical images was clicked. Text has had this since G5 (tier 3);
     * `src` never did.
     */
    const fromLoop = planLoopDataEdit(index, change, element, expression);
    if (fromLoop) return fromLoop;

    /**
     * A constant, here or in a module this file imports.
     *
     * ⚠️ G6 — THE OLD CODE REQUIRED `constant.value === change.before`, AND THAT IS A
     * TEST THE TRUTH ROUTINELY FAILS. `change.before` is what the BROWSER reported: for
     * a `next/image` it is `/_next/image?url=%2Fhero.png&w=1920&q=75`, which equals no
     * constant anywhere. We already know which element this is — the value it points at
     * is not in question — so a matching `before` is now a preference used to break a
     * tie, never a requirement.
     */
    const local = file.constants.get(expression);
    if (local) {
        return {
            ok: true,
            edits: [{ filePath: element.filePath, index: local.start, before: local.value, after: change.after }],
        };
    }

    /**
     * ⭐⭐⭐ THE SAME LOOKUP, BUT AT EVERY SCOPE AND THROUGH EVERY IMPORT.
     *
     * `file.constants` is the file's TOP LEVEL only. A url declared inside the component
     * that renders it — the ordinary way a generated page is written — lived nowhere the
     * planner could see, so it was refused as "built by your code". See
     * `ParsedFile.declarations`.
     */
    const declared = findStringDeclaration(index, element.filePath, expression, element.start);
    if (declared) {
        return {
            ok: true,
            edits: [
                { filePath: declared.filePath, index: declared.span.start, before: declared.span.value, after: change.after },
            ],
        };
    }

    /**
     * ⭐⭐ G6 — THE URL IS A PROP, SO THE EDIT BELONGS AT THE CALL SITE.
     *
     * `<img src={src}>` inside `function Figure({ src, alt, caption })` owns no url at
     * all; every `<Figure src="/b.png" />` does. Walking outwards is the only edit that
     * can change what the user is looking at, and it is the edit they meant — they
     * clicked one figure, not the component.
     */
    const fromProp = planPropEdit(index, change, element, expression);
    if (fromProp) return fromProp;

    const fromStaticImport = planStaticImportEdit(index, change, element, expression);
    if (fromStaticImport) return fromStaticImport;

    return { ok: false, reason: "unsupported" };
}

/** File extensions Next.js treats as a static image import. */
const IMAGE_IMPORT = /\.(png|jpe?g|webp|avif|gif|svg)$/i;

/**
 * ⭐⭐⭐ `<Image src={heroImage} />` WHERE `heroImage` IS A STATIC IMPORT.
 *
 * ⚠️⚠️ THIS WAS REFUSED ON PURPOSE UNTIL NOW, AND THE REASON WAS GOOD. A static import
 * carries its own intrinsic `width` and `height` — that is the whole point of importing
 * an image rather than naming a url — so swapping it for a string leaves `next/image`
 * with no dimensions, and it throws at runtime and takes the route down. The only
 * numbers available were the OLD picture's, which is a wrong aspect ratio on a page the
 * user cannot preview before it builds.
 *
 * ⭐ BUT THAT IS ONLY TRUE WHEN THE JSX IS RELYING ON THE IMPORT FOR THEM. An element
 * that already declares `width` and `height`, or `fill` (which sizes from its parent),
 * has everything `next/image` needs, and a string url in place of the import is exactly
 * what a developer would have written. So the refusal narrows from "always" to "only
 * when the dimensions would be lost".
 *
 * ⚠️ IT REWRITES THE WHOLE ATTRIBUTE, not a value inside it: `src={heroImage}` becomes
 * `src="/uploads/x.png"`. Every other planner here replaces the CONTENT of a literal,
 * so this is the one place a span covers the attribute itself.
 *
 * ⚠️ THE IMPORT STATEMENT IS DELIBERATELY LEFT ALONE. It may be used elsewhere in the
 * file, and an unused import is harmless — the template disables lint during builds.
 * Removing it would be a second, riskier edit for no user-visible gain.
 */
function planStaticImportEdit(
    index: ProjectIndex,
    change: VisualChange,
    element: SourceElement,
    expression: string
): { ok: true; edits: SpanEdit[] } | null {
    // Only a bare identifier can be a default import; `a.b` never is one.
    if (expression.includes(".")) return null;

    const file = index.files.get(element.filePath);
    if (!file) return null;

    const isStaticImage = file.imports.some(
        entry => entry.names.includes(expression) && IMAGE_IMPORT.test(entry.specifier)
    );
    if (!isStaticImage) return null;

    /**
     * ⚠️ THE DIMENSIONS HAVE TO ALREADY BE THERE. `fill` sizes from the parent;
     * `width`+`height` state it outright. Without one of those the import IS the size,
     * and replacing it would break the page — so the honest refusal stands.
     */
    const has = (name: string) => element.attrs.some(attr => attr.name === name);
    const sized = has("fill") || (has("width") && has("height"));
    if (!sized) return null;

    const attr = element.attrs.find(entry => MEDIA_ATTRS.includes(entry.name));
    if (!attr || attr.start < 0 || attr.end <= attr.start) return null;

    const before = file.content.slice(attr.start, attr.end);
    const after = `${attr.name}=${JSON.stringify(change.after)}`;
    if (before === after) return { ok: true, edits: [] };

    return {
        ok: true,
        edits: [{ filePath: element.filePath, index: attr.start, before, after }],
    };
}

/**
 * `item.src` inside `gallery.map(item => …)` → the `src` of the Nth entry of `gallery`.
 *
 * Returns `null` (not a failure) when this is not that shape, so the caller carries on
 * to the other strategies.
 */
function planLoopDataEdit(
    index: ProjectIndex,
    change: VisualChange,
    element: SourceElement,
    expression: string
): { ok: true; edits: SpanEdit[] } | { ok: false; reason: PlanFailure } | null {
    const loop = element.loop;
    if (!loop) return null;

    // ⚠️ `item.photo.large` is one property PATH, not a root and a name — the entries are
    // flattened under the same dotted paths, so the rest of the expression is the key.
    const segments = expression.split(".");
    const root = segments[0];
    const property = segments.slice(1).join(".");
    if (root !== loop.param || !property) return null;

    const found = findArray(index, element.filePath, loop.iterable, element.start);
    if (!found) return { ok: false, reason: "unsupported" };

    /**
     * ⚠️ THE ORDINAL HAS TO BE TRUSTWORTHY BEFORE IT IS USED. The agent reports which of
     * the look-alike nodes was clicked AND how many there were; when that count is the
     * length of the array, the two sets are the same set in the same order and the index
     * is exact. When it is not — a filtered list, a slice, twins the fingerprint merged
     * — falling back to "the entry whose value is the one we replaced" is still safe,
     * and refusing beats rewriting an arbitrary row.
     */
    const { entries, filePath } = found;
    const ordinal = change.signature.domOrdinal;
    const twins = change.signature.domTwins;

    let entry: { properties: Map<string, { value: string; start: number; end: number }> } | undefined;
    if (typeof ordinal === "number" && ordinal >= 0 && twins === entries.length) {
        entry = entries[ordinal];
    }
    if (!entry) {
        const byValue = entries.filter(candidate => candidate.properties.get(property)?.value === change.before);
        if (byValue.length === 1) entry = byValue[0];
    }
    if (!entry) return { ok: false, reason: "ambiguous" };

    const span = entry.properties.get(property);
    if (!span) return { ok: false, reason: "unsupported" };
    if (span.value === change.after) return { ok: true, edits: [] };

    return {
        ok: true,
        edits: [{ filePath, index: span.start, before: span.value, after: change.after }],
    };
}

/**
 * ⭐⭐ THE DECLARATION A GIVEN POSITION CAN ACTUALLY SEE.
 *
 * ⚠️ SCOPE IS THE POINT. A file with two components that each declare `images` has two
 * declarations of that name; picking the first would edit the other component's gallery
 * and report success. The narrowest scope containing the element wins, a top-level const
 * (whose scope is the whole file) is the fallback, and a genuine tie — two declarations
 * at the same width, which means neither contains the other — is answered with `null` so
 * the caller refuses rather than guesses.
 */
function declarationAt(candidates: Declaration[], at: number): Declaration | null {
    const visible = candidates.filter(entry => entry.scopeStart <= at && at <= entry.scopeEnd);
    if (visible.length === 0) return null;
    if (visible.length === 1) return visible[0];

    const width = (entry: Declaration) => entry.scopeEnd - entry.scopeStart;
    const narrowest = Math.min(...visible.map(width));
    const best = visible.filter(entry => width(entry) === narrowest);
    return best.length === 1 ? best[0] : null;
}

/**
 * The string behind `heroImage` / `SITE.hero.image`, declared here at any scope or
 * exported by a module this file imports.
 */
function findStringDeclaration(
    index: ProjectIndex,
    fromPath: string,
    path: string,
    at: number
): { span: ValueSpan; filePath: string } | null {
    const file = index.files.get(fromPath);
    if (!file) return null;

    const own = declarationAt(file.declarations.filter(entry => entry.path === path && entry.span), at);
    if (own?.span) return { span: own.span, filePath: fromPath };

    const root = path.split(".")[0];
    const known = new Set(index.files.keys());
    for (const entry of file.imports) {
        if (!entry.names.includes(root)) continue;
        const targetPath = resolveImport(fromPath, entry.specifier, known);
        if (!targetPath || targetPath === fromPath) continue;
        const target = index.files.get(targetPath);
        if (!target) continue;
        /**
         * ⚠️ THE IMPORTED NAME MAY BE THE WHOLE PATH OR ONLY ITS ROOT. `import { assets }`
         * used as `assets.hero` matches the module's own `assets.hero`; a default import
         * renamed at the call site matches on the tail alone. Both were already tried by
         * the code this replaced; the difference is that the paths may now be deeper.
         */
        for (const key of [path, path.split(".").slice(1).join("."), root]) {
            if (!key) continue;
            // ⚠️ Only the target's TOP LEVEL is importable, and its scope is the file — so
            // position 0 is inside it and a local const of the same name is excluded.
            const found = declarationAt(target.declarations.filter(item => item.path === key && item.span), 0);
            if (found?.span) return { span: found.span, filePath: targetPath };
        }
    }

    return null;
}

/** The array behind `gallery`, whether it is declared here or imported. */
function findArray(
    index: ProjectIndex,
    fromPath: string,
    name: string,
    at = 0
): { entries: ArrayEntry[]; filePath: string } | null {
    const file = index.files.get(fromPath);
    if (!file) return null;

    const own = file.arrays.get(name);
    if (own) return { entries: own, filePath: fromPath };

    /**
     * ⭐⭐⭐ THE ARRAY IS DECLARED INSIDE THE COMPONENT, WHICH IS WHERE MOST OF THEM ARE.
     *
     * `file.arrays` is the top level only, so `const team = [{ photo: "…" }]` written in
     * the component that maps over it was invisible — and an image in that map was
     * refused with "built by your code rather than written in it". It is written; it was
     * simply four lines out of view. `SITE.gallery` (an array inside an object) resolves
     * here too, under its dotted path.
     */
    const scoped = declarationAt(file.declarations.filter(entry => entry.path === name && entry.entries), at);
    if (scoped?.entries) return { entries: scoped.entries, filePath: fromPath };

    const root = name.split(".")[0];
    const known = new Set(index.files.keys());
    for (const entry of file.imports) {
        if (!entry.names.includes(root)) continue;
        const targetPath = resolveImport(fromPath, entry.specifier, known);
        if (!targetPath || targetPath === fromPath) continue;
        const target = index.files.get(targetPath);
        if (!target) continue;
        const imported = target.arrays.get(name);
        if (imported) return { entries: imported, filePath: targetPath };
        // ⚠️ `SITE.gallery` — an array inside an exported object, which `arrays` (one
        // level, top level) never held. Only the module's own top level is importable.
        for (const key of [name, name.split(".").slice(1).join("."), root]) {
            if (!key) continue;
            const found = declarationAt(target.declarations.filter(item => item.path === key && item.entries), 0);
            if (found?.entries) return { entries: found.entries, filePath: targetPath };
        }
    }
    return null;
}

/**
 * `src` inside `function Figure({ src })` → the `src=""` on the `<Figure>` call site.
 *
 * ⚠️ IT REFUSES WHEN THERE IS MORE THAN ONE CALL SITE IT CANNOT TELL APART. Two
 * `<Figure>`s on the page and no ordinal to separate them is precisely the case where a
 * guess rewrites the wrong picture, which is the failure this whole change exists to
 * remove.
 */
function planPropEdit(
    index: ProjectIndex,
    change: VisualChange,
    element: SourceElement,
    expression: string
): { ok: true; edits: SpanEdit[] } | { ok: false; reason: PlanFailure } | null {
    const owner = element.ownerComponent;
    // A dotted expression (`props.src`) names the prop in its second half.
    const [root, property] = expression.split(".");
    const propName = property || root;
    if (!owner || !propName) return null;

    const reachability = reachabilityFor(index, change.signature.route);
    const known = new Set(index.files.keys());

    /** Every `<Owner …>` in a file that can see this component. */
    const sites: { filePath: string; attr: NonNullable<SourceElement["attrs"]>[number] }[] = [];
    for (const [path, file] of index.files) {
        if (path !== element.filePath) {
            // Only files that actually import the component from the file it lives in.
            const imports = file.imports.some(
                entry =>
                    entry.names.includes(owner) &&
                    resolveImport(path, entry.specifier, known) === element.filePath
            );
            if (!imports) continue;
        }
        if (!reachability.has(path)) continue;

        for (const candidate of file.elements) {
            if (candidate.tag !== owner) continue;
            const attr = candidate.attrs.find(entry => entry.name === propName);
            if (attr?.value !== null && attr?.valueStart >= 0) sites.push({ filePath: path, attr });
        }
    }

    if (sites.length === 0) return null;

    let chosen = sites[0];
    if (sites.length > 1) {
        const byValue = sites.filter(site => site.attr.value === change.before);
        const ordinal = change.signature.domOrdinal;
        if (byValue.length === 1) chosen = byValue[0];
        else if (typeof ordinal === "number" && change.signature.domTwins === sites.length && sites[ordinal]) {
            chosen = sites[ordinal];
        } else return { ok: false, reason: "ambiguous" };
    }

    if (chosen.attr.value === change.after) return { ok: true, edits: [] };

    return {
        ok: true,
        edits: [
            {
                filePath: chosen.filePath,
                index: chosen.attr.valueStart,
                before: index.files.get(chosen.filePath)!.content.slice(chosen.attr.valueStart, chosen.attr.valueEnd),
                after: change.after,
            },
        ],
    };
}

// ─── Tier 3: the data behind the element ─────────────────────────────────────

/**
 * ⭐⭐ THE COPY IS OFTEN NOT IN THE MARKUP AT ALL.
 *
 * Every generated project of any size holds its features, testimonials, pricing tiers
 * and nav labels in an array and renders them through `.map()`. The `<h3>` the user
 * clicked contains `{feature.title}` — no static text, nothing for tier 2 to match on
 * — so the old matcher answered `not-found` for what is, to the user, the most obvious
 * text on the page.
 *
 * The string is findable: it is a string literal somewhere in a file the route renders,
 * and if it appears exactly once there is nothing ambiguous about editing it. This runs
 * only after tiers 1 and 2 have failed, and only for text changes.
 *
 * ⚠️ IT REFUSES ON MULTIPLE HITS, and does not fall back to "the first one". Two
 * identical strings in the data are exactly the case where a wrong guess silently
 * rewrites the wrong card.
 */
export function findTextInData(
    index: ProjectIndex,
    change: VisualChange,
    rawFiles: Map<string, string>
): { ok: true; edits: SpanEdit[] } | { ok: false; reason: PlanFailure } {
    const needle = normalizeText(change.before);
    if (!needle || needle.length < 2) return { ok: false, reason: "not-found" };

    const reachability = reachabilityFor(index, change.signature.route);
    const hits: { filePath: string; index: number; before: string; depth: number }[] = [];

    for (const [path, content] of rawFiles) {
        const depth = reachability.get(path);
        // Every file is searched, but an unreachable one only counts if nothing else hit.
        const pattern = new RegExp(`(["'\`])${escapeRegExp(needle)}\\1`, "g");
        let found: RegExpExecArray | null;
        while ((found = pattern.exec(content)) !== null) {
            hits.push({ filePath: path, index: found.index + 1, before: needle, depth: depth ?? 99 });
        }
    }

    if (hits.length === 0) return { ok: false, reason: "not-found" };

    const reachable = hits.filter(hit => hit.depth < 99);
    const pool = reachable.length > 0 ? reachable : hits;
    if (pool.length > 1) {
        const nearest = Math.min(...pool.map(hit => hit.depth));
        const closest = pool.filter(hit => hit.depth === nearest);
        if (closest.length !== 1) return { ok: false, reason: "ambiguous" };
        return { ok: true, edits: [toDataEdit(closest[0], change)] };
    }

    return { ok: true, edits: [toDataEdit(pool[0], change)] };
}

function toDataEdit(
    hit: { filePath: string; index: number; before: string },
    change: VisualChange
): SpanEdit {
    return {
        filePath: hit.filePath,
        index: hit.index,
        before: hit.before,
        after: JSON.stringify(change.after).slice(1, -1),
    };
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
