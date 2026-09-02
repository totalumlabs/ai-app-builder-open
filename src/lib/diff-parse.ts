/**
 * ═══ UNIFIED (GIT) DIFF PARSING ═════════════════════════════════════════════
 *
 * Turns the raw patch behind a conversation message's `gitDiffUrl` into per-file
 * blocks the viewer can render.
 *
 * Handles every shape VCaaS emits: `diff --git` headers, new/deleted file modes,
 * renames, binary markers and `@@` hunks. **Anything unrecognised is kept as a
 * `meta` line rather than dropped** — a review that silently omits part of the
 * patch is worse than one that shows a line it does not understand.
 *
 * Pure module. Unit-tested by `src/lib/__tests__/diff-parse.test.ts`.
 */

export type LineKind = "add" | "del" | "context" | "hunk" | "meta";

export interface DiffLine {
    kind: LineKind;
    content: string;
    /** Line number in the original file. `null` for additions and headers. */
    oldNo: number | null;
    /** Line number in the new file. `null` for deletions and headers. */
    newNo: number | null;
    /**
     * Character ranges that actually changed, for word-level highlighting.
     * Present only on `add`/`del` lines that could be paired with a counterpart.
     */
    ranges?: [start: number, end: number][];
}

export type FileStatus = "added" | "deleted" | "renamed" | "modified";

export interface DiffFile {
    /** The new path, or the old path when the file was deleted. */
    path: string;
    oldPath: string | null;
    status: FileStatus;
    isBinary: boolean;
    additions: number;
    deletions: number;
    lines: DiffLine[];
}

/** git prefixes diff paths with `a/` and `b/`. */
function stripPrefix(path: string): string {
    return path.replace(/^[ab]\//, "");
}

export function parseDiff(raw: string): DiffFile[] {
    const files: DiffFile[] = [];
    if (!raw) return files;

    let current: DiffFile | null = null;
    let oldNo = 0;
    let newNo = 0;

    const flush = () => {
        if (current) {
            addWordRanges(current);
            files.push(current);
        }
    };

    for (const line of raw.split("\n")) {
        if (line.startsWith("diff --git ")) {
            flush();
            // Paths may contain spaces, so match the `a/… b/…` pair rather than
            // splitting on whitespace.
            const match = line.match(/^diff --git (.+?) (b\/.+)$/);
            const oldPath = match ? stripPrefix(match[1]) : "";
            const newPath = match ? stripPrefix(match[2]) : "";
            current = {
                path: newPath || oldPath,
                oldPath: oldPath && oldPath !== newPath ? oldPath : null,
                status: "modified",
                isBinary: false,
                additions: 0,
                deletions: 0,
                lines: [],
            };
            continue;
        }

        // Anything before the first `diff --git` is preamble.
        if (!current) continue;

        if (line.startsWith("new file mode")) {
            current.status = "added";
            continue;
        }
        if (line.startsWith("deleted file mode")) {
            current.status = "deleted";
            continue;
        }
        if (line.startsWith("rename from ")) {
            current.status = "renamed";
            current.oldPath = line.slice("rename from ".length);
            continue;
        }
        if (line.startsWith("rename to ")) {
            current.status = "renamed";
            current.path = line.slice("rename to ".length);
            continue;
        }
        if (line.startsWith("Binary files") || line.startsWith("GIT binary patch")) {
            current.isBinary = true;
            current.lines.push({ kind: "meta", content: line, oldNo: null, newNo: null });
            continue;
        }

        // Noise with no value in a review.
        if (
            line.startsWith("index ") ||
            line.startsWith("old mode") ||
            line.startsWith("new mode") ||
            line.startsWith("similarity index") ||
            line.startsWith("dissimilarity index") ||
            line.startsWith("--- ") ||
            line.startsWith("+++ ")
        ) {
            continue;
        }

        const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunk) {
            oldNo = Number.parseInt(hunk[1], 10);
            newNo = Number.parseInt(hunk[2], 10);
            current.lines.push({ kind: "hunk", content: line, oldNo: null, newNo: null });
            continue;
        }

        if (line.startsWith("+")) {
            current.additions++;
            current.lines.push({ kind: "add", content: line.slice(1), oldNo: null, newNo: newNo++ });
        } else if (line.startsWith("-")) {
            current.deletions++;
            current.lines.push({ kind: "del", content: line.slice(1), oldNo: oldNo++, newNo: null });
        } else if (line.startsWith("\\")) {
            // "\ No newline at end of file"
            current.lines.push({ kind: "meta", content: line, oldNo: null, newNo: null });
        } else if (line.startsWith(" ") || line === "") {
            current.lines.push({ kind: "context", content: line.slice(1), oldNo: oldNo++, newNo: newNo++ });
        } else {
            current.lines.push({ kind: "meta", content: line, oldNo: null, newNo: null });
        }
    }

    flush();

    // The patch's trailing newline produces one phantom empty context line.
    for (const file of files) {
        const last = file.lines[file.lines.length - 1];
        if (last && last.kind === "context" && last.content === "") file.lines.pop();
    }

    return files;
}

// ═══════════════════════════════════════════════════════════════════════════
//  WORD-LEVEL HIGHLIGHTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A unified diff only says "this line changed". When a line changed by one
 * character — a renamed variable, a flipped boolean — the reader has to compare
 * two nearly identical rows by eye. Word-level ranges mark the part that actually
 * differs, which is the whole point of reading a diff.
 *
 * THE ALGORITHM, and why it is this one:
 *
 *   1. Pair each run of deletions with the immediately following run of additions,
 *      positionally (1st del ↔ 1st add, …). Real edits almost always come out of
 *      `git diff` in that order.
 *   2. For each pair, tokenise both sides, then strip the COMMON PREFIX and COMMON
 *      SUFFIX. What remains in the middle is the change.
 *
 * That is deliberately not a full Myers diff. Prefix/suffix trimming is O(n), has
 * no pathological cases on minified or very long lines, and produces the same
 * answer as a real LCS for the overwhelming majority of single-line edits. A full
 * character LCS on a 20 000-character bundle line would hang the tab, which is a
 * far worse outcome than a slightly coarse highlight.
 *
 * ⚠️ Pairs whose lines share nothing are left UNMARKED rather than fully
 * highlighted — marking every character adds noise and communicates nothing.
 */

/** Split into words, whitespace and single symbols — the units a reader compares. */
function tokenize(text: string): string[] {
    return text.match(/[A-Za-z0-9_$]+|\s+|[^\sA-Za-z0-9_$]/g) || [];
}

/** Lines longer than this skip word-diffing entirely (minified output). */
const MAX_WORD_DIFF_CHARS = 2000;

/** Below this ratio of shared content the two lines are unrelated; don't mark. */
const MIN_SIMILARITY = 0.25;

function wordRanges(
    before: string,
    after: string
): { del: [number, number][]; add: [number, number][] } | null {
    if (before === after) return null;
    if (before.length > MAX_WORD_DIFF_CHARS || after.length > MAX_WORD_DIFF_CHARS) return null;

    const a = tokenize(before);
    const b = tokenize(after);

    // Common prefix.
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;

    // Common suffix, never overlapping the prefix.
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
        endA--;
        endB--;
    }

    const charsOf = (tokens: string[], from: number, to: number) =>
        tokens.slice(from, to).reduce((sum, token) => sum + token.length, 0);

    const sharedChars = charsOf(a, 0, start) + charsOf(a, endA, a.length);
    const longest = Math.max(before.length, after.length);
    if (longest > 0 && sharedChars / longest < MIN_SIMILARITY) return null;

    const rangeFor = (tokens: string[], from: number, to: number): [number, number][] => {
        if (from >= to) return [];
        const startChar = charsOf(tokens, 0, from);
        const endChar = startChar + charsOf(tokens, from, to);
        return [[startChar, endChar]];
    };

    return {
        del: rangeFor(a, start, endA),
        add: rangeFor(b, start, endB),
    };
}

/** Walk a file's lines, pairing del/add runs and attaching ranges in place. */
function addWordRanges(file: DiffFile): void {
    const lines = file.lines;
    let i = 0;

    while (i < lines.length) {
        if (lines[i].kind !== "del") {
            i++;
            continue;
        }

        const delStart = i;
        while (i < lines.length && lines[i].kind === "del") i++;
        const delEnd = i;

        const addStart = i;
        while (i < lines.length && lines[i].kind === "add") i++;
        const addEnd = i;

        // Pair positionally over the overlapping portion of the two runs.
        const pairs = Math.min(delEnd - delStart, addEnd - addStart);
        for (let n = 0; n < pairs; n++) {
            const del = lines[delStart + n];
            const add = lines[addStart + n];
            const ranges = wordRanges(del.content, add.content);
            if (ranges) {
                del.ranges = ranges.del;
                add.ranges = ranges.add;
            }
        }
    }
}

/**
 * Split a line into rendered segments using its `ranges`.
 * Returns one segment when there is nothing to highlight.
 */
export function segmentLine(
    line: DiffLine
): { text: string; changed: boolean }[] {
    if (!line.ranges?.length) return [{ text: line.content, changed: false }];

    const segments: { text: string; changed: boolean }[] = [];
    let cursor = 0;

    for (const [start, end] of line.ranges) {
        if (start > cursor) segments.push({ text: line.content.slice(cursor, start), changed: false });
        segments.push({ text: line.content.slice(start, end), changed: true });
        cursor = end;
    }

    if (cursor < line.content.length) {
        segments.push({ text: line.content.slice(cursor), changed: false });
    }

    return segments;
}

/** Totals for the viewer header. */
export function diffTotals(files: DiffFile[]): { additions: number; deletions: number } {
    return files.reduce(
        (totals, file) => ({
            additions: totals.additions + file.additions,
            deletions: totals.deletions + file.deletions,
        }),
        { additions: 0, deletions: 0 }
    );
}
