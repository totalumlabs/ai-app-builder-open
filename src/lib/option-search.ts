/**
 * ═══ SEARCHING A LIST THAT MIGHT HAVE A HUNDRED THOUSAND THINGS IN IT ════════
 *
 * The pure half of `SearchableSelect`. No React, no DOM — so the one property
 * that actually keeps the page alive (that the rendered slice is BOUNDED, no
 * matter what comes in) is a unit test rather than something you confirm by
 * signing in as an account with 100 000 projects.
 *
 * ── THE PROBLEM THIS EXISTS FOR ─────────────────────────────────────────────
 *
 * ⚠️ A `<select>` renders one `<option>` per entry, EAGERLY, whether or not it
 * is open. The usage page's project filter did exactly that over an unbounded
 * list, so an account with tens of thousands of projects paid tens of thousands
 * of DOM nodes on every render of the page — and past roughly a hundred thousand
 * the tab stops responding altogether. Searching was never the point on its own;
 * the point is that a search box makes it *reasonable* to render only a slice.
 *
 * ⚠️ FILTERING IS CHEAP; RENDERING IS NOT. Scanning 100 000 short strings per
 * keystroke is single-digit milliseconds. Mounting 100 000 rows is seconds and a
 * few hundred megabytes. So this filters everything and returns at most `limit`,
 * and the caller renders exactly what it gets back.
 */

export interface SearchableOption {
    value: string;
    /** What the user reads and types against. Falls back to `value`. */
    label?: string;
    /** Secondary text, also searched — a description, a name, a count. */
    hint?: string;
}

/** How many rows are ever handed to the DOM at once. */
export const OPTION_RENDER_LIMIT = 50;

export interface OptionSearchResult<T extends SearchableOption> {
    /** At most `limit` options — this is what gets rendered. */
    shown: T[];
    /** How many matched in total, INCLUDING the ones that were not returned. */
    matched: number;
    /** `matched - shown.length`. Zero when everything that matched is on screen. */
    hidden: number;
}

/**
 * Filter `options` by `query` and cap the result.
 *
 * ⚠️ THE CAP APPLIES TO THE EMPTY QUERY TOO, and that is the whole safety
 * property. An early version only capped once someone typed, which meant the
 * very first paint — the one nobody has had a chance to narrow yet — was still
 * the unbounded one.
 *
 * ⚠️ SUBSTRING, NOT FUZZY. These are ids and slugs (`booking-padel-club-a1b2`),
 * where fuzzy matching mostly produces confident nonsense: someone typing
 * "padel" wants the padel projects, not everything containing p-a-d-e-l in
 * order. Matching is case-insensitive and covers `label`, `value` and `hint`.
 */
export function searchOptions<T extends SearchableOption>(
    options: readonly T[],
    query: string,
    limit: number = OPTION_RENDER_LIMIT
): OptionSearchResult<T> {
    const needle = query.trim().toLowerCase();
    const cap = Math.max(0, limit);

    if (!needle) {
        return {
            shown: options.slice(0, cap) as T[],
            matched: options.length,
            hidden: Math.max(0, options.length - cap),
        };
    }

    const shown: T[] = [];
    let matched = 0;

    /*
     * ⚠️ ONE PASS, AND IT DOES NOT STOP EARLY. `matched` is the honest total, and
     * "12 more — keep typing" is only true if we counted them all. The loop stays
     * O(n) either way; it is only the PUSH that is bounded.
     */
    for (const option of options) {
        if (!matchesQuery(option, needle)) continue;
        matched++;
        if (shown.length < cap) shown.push(option);
    }

    return { shown, matched, hidden: matched - shown.length };
}

function matchesQuery(option: SearchableOption, needle: string): boolean {
    if (option.value.toLowerCase().includes(needle)) return true;
    if (option.label && option.label.toLowerCase().includes(needle)) return true;
    if (option.hint && option.hint.toLowerCase().includes(needle)) return true;
    return false;
}

/**
 * Is `query` usable as a value in its own right?
 *
 * ⚠️ THIS IS WHAT MAKES A TRUNCATED LIST HONEST. When the server can only send
 * the first N ids (see the usage analytics bridge), the project someone wants
 * may genuinely not be in `options` — and the filter itself accepts ANY id,
 * because it is applied by the server against a set already scoped to this
 * account. So when nothing matches, the exact text is offered as the value. A
 * dropdown that can only ever select what it happens to have downloaded is the
 * bug we are fixing, not the fix.
 */
export function isUsableRawValue(query: string): boolean {
    const trimmed = query.trim();
    return trimmed.length > 0 && !/\s/.test(trimmed);
}
