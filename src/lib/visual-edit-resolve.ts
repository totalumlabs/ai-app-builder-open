/**
 * ═══ THE TIERED RESOLVER (Feature G5) ═══════════════════════════════════════
 *
 * ⚠️⚠️ SERVER ONLY, AND THAT IS A HARD CONSTRAINT RATHER THAN A CONVENTION. This
 * module reaches `visual-edit-source.ts`, which loads **the TypeScript compiler** to
 * parse TSX. `visual-edit.ts` is imported by the inspector panel and the changes bar,
 * so putting any of this in there would drag a 10 MB parser into the browser bundle of
 * every workspace page. The split is what keeps the client bundle exactly as it was.
 *
 * ── WHY THERE ARE FOUR TIERS ────────────────────────────────────────────────
 *
 * A user applied twelve changes to a real project and was told:
 *
 *     2 changes written to 1 file.
 *     10 changes could not be placed:
 *       · we couldn't find that exact text in the source
 *       · we weren't confident enough in the match to change it
 *       · it appears in several places and we can't tell which you meant
 *
 * All three sentences, one batch. They are three symptoms of one cause — the old
 * matcher compared the RENDERED string against the SOURCE text — and each tier below
 * removes a class of that failure:
 *
 *   1 · **The build tag.** Nothing to compare: the element says where it was written.
 *   2 · **Structure.** Compare trees, not strings. Understands `cn()`, `cva`,
 *       template literals, `&apos;`, collapsed whitespace, components and lists, and
 *       accepts a unique match instead of demanding an arbitrary score.
 *   3 · **The data.** The copy behind a `.map()` lives in an array, not in the markup.
 *   4 · **The original regex matcher**, untouched, for whatever the parser could not
 *       read. It is consulted last and never overrides a higher tier.
 */

import {
    HIGH_CONFIDENCE,
    resolveChanges as resolveChangesLegacy,
    type ElementSignature,
    type ResolutionResult,
    type ResolvedEdit,
    type UnmappedChange,
    type VisualChange,
} from "./visual-edit";
import {
    buildProjectIndex,
    findTextInData,
    locateElement,
    planEdit,
    type Located,
    type PlanFailure,
    type ProjectIndex,
    type SpanEdit,
} from "./visual-edit-match";

/** Per-tier counts, reported to the client so a failure can be explained rather than guessed at. */
export interface EngineStats {
    /** Changes resolved by `data-tlm-loc`. */
    exact: number;
    /** Changes resolved by structural matching. */
    structural: number;
    /** Changes resolved by finding the string in a data array. */
    data: number;
    /** Changes resolved by the original regex matcher. */
    legacy: number;
    /** `true` when the project was built with the source-tag loader. */
    sourceTagged: boolean;
    /** `false` when the parser could not run at all — every change went to tier 4. */
    parsed: boolean;
}

export interface DeepResolution extends ResolutionResult {
    engine: EngineStats;
}

/**
 * ⭐⭐⭐ UNDO THE BATCH'S OWN DRIFT BEFORE TRYING TO MATCH.
 *
 * ⚠️⚠️ EVERY CHANGE IS APPLIED TO THE LIVE PREVIEW THE MOMENT IT IS MADE — that is the
 * point of a visual editor — so the page the user is looking at stops being the page the
 * files describe. Select an element after recolouring it and the signature reports
 * `text-[#cf5230]`, a token that is in no file. Select its neighbour and the signature's
 * `parentClassName` is drifted. Retype a heading and every sibling that mentions it in
 * `prevSiblingText` is drifted too.
 *
 * That is not a nuisance, it is actively dangerous: the matcher DISQUALIFIES a candidate
 * whose text or classes disagree with the DOM, so drift makes the one correct element
 * look wrong. Twelve changes means eleven chances for it to happen.
 *
 * The batch carries the cure. Every change knows the value BEFORE it was made, so a
 * reverse lookup over the whole batch turns any drifted value back into what the file
 * says. It is exact-string keyed and idempotent: a value nothing in the batch touched is
 * returned unchanged.
 */
export function pristine(signature: ElementSignature, changes: VisualChange[]): ElementSignature {
    /** DOM value → source value, for classes and for text, taken from the batch itself. */
    const classUndo = new Map<string, string>();
    const textUndo: { after: string; before: string }[] = [];

    for (const change of changes) {
        if (change.kind === "class") {
            if (change.after && change.after !== change.before) classUndo.set(change.after, change.before);
        } else if (change.kind === "text") {
            if (change.after && change.after !== change.before) {
                textUndo.push({ after: change.after, before: change.before });
            }
        }
    }

    if (classUndo.size === 0 && textUndo.length === 0) return signature;

    const undoClass = (value: string | null | undefined): string | null =>
        value ? (classUndo.get(value) ?? value) : (value ?? null);

    /** Text can be embedded (a parent's `subtreeText`), so this substitutes rather than swaps. */
    const undoText = (value: string | null | undefined): string | null => {
        if (!value) return value ?? null;
        let out = value;
        for (const entry of textUndo) if (out.includes(entry.after)) out = out.split(entry.after).join(entry.before);
        return out;
    };

    const className = undoClass(signature.className);

    return {
        ...signature,
        className,
        // ⚠️ Re-derived from the restored string, never carried over: the two must agree.
        classTokens: className ? className.split(/\s+/).filter(Boolean) : [],
        parentClassName: undoClass(signature.parentClassName),
        text: undoText(signature.text),
        subtreeText: undoText(signature.subtreeText),
        prevSiblingText: undoText(signature.prevSiblingText),
        nextSiblingText: undoText(signature.nextSiblingText),
        path: signature.path?.map(step => {
            const restored = undoClass(step.tokens.join(" "));
            return { ...step, tokens: restored ? restored.split(/\s+/).filter(Boolean) : [] };
        }),
    };
}

export function resolveChangesDeep(files: Map<string, string>, changes: VisualChange[]): DeepResolution {
    const edits: ResolvedEdit[] = [];
    const unmapped: UnmappedChange[] = [];
    const satisfied: string[] = [];
    const engine: EngineStats = { exact: 0, structural: 0, data: 0, legacy: 0, sourceTagged: false, parsed: false };

    let index: ProjectIndex | null = null;
    try {
        index = buildProjectIndex(files);
        engine.parsed = true;
    } catch (error) {
        /**
         * ⚠️ A PARSER FAILURE DEGRADES, IT DOES NOT FAIL. The old engine is still there
         * and still correct for the cases it handled; losing the new one costs accuracy,
         * not the user's batch.
         */
        console.error("[visual-edit] source parsing unavailable, using text matching only:", error);
    }

    engine.sourceTagged = changes.some(change => Boolean(change.signature?.loc));

    /** Spans claimed so far, so no two changes in a batch can rewrite the same characters. */
    const claimed: { filePath: string; start: number; end: number }[] = [];
    const collides = (edit: { filePath: string; index: number; before: string }) =>
        claimed.some(
            span =>
                span.filePath === edit.filePath &&
                edit.index < span.end &&
                span.start < edit.index + edit.before.length
        );

    const commit = (
        change: VisualChange,
        planned: SpanEdit[],
        score: number,
        reasons: string[],
        /** Every change this edit satisfies — a group is written once and clears them all. */
        changeIds: string[] = [change.id]
    ): boolean => {
        if (planned.some(collides)) return false;
        for (const edit of planned) {
            claimed.push({ filePath: edit.filePath, start: edit.index, end: edit.index + edit.before.length });
            edits.push({
                changeId: change.id,
                changeIds,
                filePath: edit.filePath,
                index: edit.index,
                before: edit.before,
                after: edit.after,
                score,
                reasons,
                confident: score >= HIGH_CONFIDENCE,
            });
        }
        return true;
    };

    /** Changes tiers 1–3 could not place, handed to the original matcher as a batch. */
    const leftovers: VisualChange[] = [];

    /**
     * ⭐⭐⭐ ONE ELEMENT, ONE EDIT — COMPOSED, NOT COLLIDED.
     *
     * ⚠️⚠️ THIS IS THE FIX FOR THE SECOND ROUND OF "5 of 12 could not be placed", AND IT
     * WAS 97 OF 99 REFUSALS IN A MEASURED SESSION.
     *
     * Recolour a heading, then make it bigger. Those are two changes to ONE class
     * attribute, and the store only collapses them if they were made back to back on the
     * same selection — re-clicking the heading mints a new `selectionId`, so a perfectly
     * ordinary way of working produces two. Planned independently they want the same
     * characters, and the loser was reported as `overlapping`: "another change already
     * rewrote that part of the file, apply again". The user's answer to that is to press
     * Apply a second time, wait through a second rebuild, and wonder why.
     *
     * They are not in conflict — they are consecutive states of one value. The change
     * carries the value BEFORE and AFTER, so composing a group is just taking the FIRST
     * `before` (which is what the file says) and the LAST `after` (which is what the user
     * wants). Every intermediate state cancels, and one edit lands for the group.
     *
     * ⚠️ GROUPED BY RESOLVED ELEMENT, NOT BY SELECTION. Two selections of one element are
     * the same element; that is the whole point, and `selectionId` cannot see it.
     */
    interface Group {
        key: string;
        element: Located;
        kind: VisualChange["kind"];
        members: VisualChange[];
    }
    const groups = new Map<string, Group>();
    const order: Group[] = [];

    for (const change of changes) {
        if (!index) {
            leftovers.push(change);
            continue;
        }

        /**
         * ⚠️ THE SIGNATURE IS UN-DRIFTED FIRST. Every change is applied to the live
         * preview the instant it is made, so a signature captured for the second edit of
         * an element describes classes and text that exist in no file. See `pristine`.
         */
        const located = locateElement(index, pristine(change.signature, changes), change.kind);

        if (located.ok) {
            const key = `${located.match.element.filePath}#${located.match.element.index}#${change.kind}`;
            const existing = groups.get(key);
            if (existing) {
                existing.members.push(change);
                continue;
            }
            const group: Group = { key, element: located.match, kind: change.kind, members: [change] };
            groups.set(key, group);
            order.push(group);
            continue;
        }

        /**
         * Tier 3 — the element is a `.map()` template and the words the user edited are
         * in the array behind it. Only for text: a class or a `src` on a mapped element
         * genuinely lives in the markup, so failing to place one there is real.
         */
        if (change.kind === "text") {
            const data = findTextInData(index, change, files);
            if (data.ok && data.edits.length > 0 && commit(change, data.edits, HIGH_CONFIDENCE, ["data"])) {
                engine.data++;
                continue;
            }
        }

        leftovers.push(change);
    }

    // ── Plan one edit per group ─────────────────────────────────────────────
    for (const group of order) {
        const first = group.members[0];
        const last = group.members[group.members.length - 1];
        /**
         * The composed change: the file's value → the user's final value. `id` is the
         * first member's, and `changeIds` names them all so every one of them clears the
         * unsaved-changes bar when the write lands.
         */
        const composed: VisualChange = { ...first, before: first.before, after: last.after };

        if (composed.before === composed.after) {
            for (const member of group.members) satisfied.push(member.id);
            continue;
        }

        const ids = group.members.map(member => member.id);
        const plan = index ? planEdit(index, composed, group.element) : { ok: false as const, reason: "not-found" as const };
        /**
         * ⚠️ READ OFF THE UNION BY HAND, because this repo compiles with
         * `strictNullChecks: false` — under which TS does not narrow a union on a
         * boolean-literal discriminant. Same reason `isUnsafe` and `bridgeFailed` exist.
         */
        const planFailure: PlanFailure | null = plan.ok ? null : (plan as { reason: PlanFailure }).reason;

        if (plan.ok) {
            /**
             * ⚠️ AN EMPTY PLAN IS A SUCCESS, NOT A MISS. The element was found and the
             * file already says what the user asked for — a repeated edit, or a change the
             * agent had already written before a rebuild landed. Calling that a failure is
             * what used to leave a satisfied change stuck in the bar with an error
             * describing something that was already true.
             */
            if (plan.edits.length === 0) {
                satisfied.push(...ids);
                continue;
            }
            if (commit(composed, plan.edits, group.element.score, group.element.reasons, ids)) {
                if (group.element.exact) engine.exact += ids.length;
                else engine.structural += ids.length;
                continue;
            }
            /**
             * ⚠️ STILL POSSIBLE, AND NO LONGER THE COMMON CASE: two DIFFERENT elements
             * whose edits genuinely want the same characters — a parent and a child that
             * resolve to one class literal, say. Grouping cannot compose those, so the
             * first still wins and the second is honestly reported.
             */
            for (const id of ids) unmapped.push({ changeId: id, reason: "overlapping", occurrences: 1 });
            continue;
        }

        /**
         * Tier 3 — the element is a `.map()` template and the words the user edited are
         * in the array behind it. Only for text: a class or a `src` on a mapped element
         * genuinely lives in the markup, so failing to place one there is real.
         */
        if (index && group.kind === "text") {
            const data = findTextInData(index, composed, files);
            if (data.ok && data.edits.length > 0 && commit(composed, data.edits, HIGH_CONFIDENCE, ["data"], ids)) {
                engine.data += ids.length;
                continue;
            }
        }

        /**
         * ⭐⭐⭐ G6 — WE KNOW WHICH ELEMENT THIS IS. IT NEVER GOES TO THE BLIND MATCHER.
         *
         * ⚠️⚠️ THIS IS THE FIX FOR AN EDIT THAT LANDED ON A DIFFERENT ELEMENT IN A
         * DIFFERENT SECTION OF THE PAGE, AND REPORTED ITSELF AS APPLIED.
         *
         * Reaching here means a tier ABOVE identified the element and `planEdit` could
         * not produce characters for it — `src={item.src}` inside a `.map()`, a `src`
         * that is a component prop, a static import. That is a gap in the PLANNER, and
         * the element is not in doubt.
         *
         * It used to fall into `leftovers`, i.e. into tier 4, whose entire method is to
         * search the raw file text for the `before` string. Tier 4 does not know which
         * element we found and cannot be told. Measured on the media fixture: the user
         * replaced the first image of a two-image gallery, tier 4 went looking for
         * "/g1.png", found it in `<source srcSet="/g1.png">` inside an unrelated
         * `<picture>` forty lines away, and rewrote THAT — reported `✔ applied,
         * confident`. The gallery was unchanged and a different image broke.
         *
         * A refusal that names the real reason is worth more than a write that might be
         * anywhere. Tier 4 still exists, and still runs — but only for changes where no
         * tier could identify an element at all, which is the situation it was written
         * for.
         */
        if (planFailure === "unsupported") {
            for (const id of ids) unmapped.push({ changeId: id, reason: "unsupported", occurrences: 1 });
            continue;
        }

        leftovers.push(...group.members);
    }

    // ── Tier 4 ──────────────────────────────────────────────────────────────
    if (leftovers.length > 0) {
        const legacy = resolveChangesLegacy(files, leftovers);
        satisfied.push(...legacy.satisfied);
        unmapped.push(...legacy.unmapped);

        for (const edit of legacy.edits) {
            if (collides(edit)) {
                unmapped.push({ changeId: edit.changeId, reason: "overlapping", occurrences: 1 });
                continue;
            }
            claimed.push({ filePath: edit.filePath, start: edit.index, end: edit.index + edit.before.length });
            edits.push(edit);
            engine.legacy++;
        }
    }

    return { edits, unmapped, satisfied, engine };
}
