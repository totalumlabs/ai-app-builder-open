/**
 * ═══ HOW LONG A RUN HAS BEEN GOING, AND WHETHER IT IS STUCK ═════════════════
 *
 * The agent reports `init` or `done` and nothing in between — no percentage, no
 * step count, no estimate. So everything the chat can say about progress has to be
 * derived from two facts: when the run started, and how many build steps have
 * arrived. This module owns that arithmetic, and it is pure so the two judgements
 * that matter can be tested instead of watched for twenty-five minutes:
 *
 *   · the bar never claims to be finished when it is not;
 *   · "the agent looks stuck" is only ever said when it really might be.
 *
 * ── WHY 4 TO 10 MINUTES ────────────────────────────────────────────────────
 *
 * ⚠️⚠️ THIS USED TO SAY "6 to ~25 min" AND IT WAS WRONG BY A FACTOR OF THREE.
 * Real runs land between four and ten minutes; quoting twenty-five made the bar
 * crawl (a five-minute run finished at 20 %, which reads as "barely started") and
 * made every honest estimate look like a broken one. The range is now the one we
 * actually observe, and it is the SINGLE SOURCE OF TRUTH: the chat's bar fills
 * against `RUN_ESTIMATE_MS`, the first-build loader's phase table is weighted
 * against the same number (see `STAGE_WEIGHTS` in `first-run.ts`), and the copy
 * beside both quotes `RUN_ESTIMATE_MIN_MS` → `RUN_ESTIMATE_MS`.
 *
 * It is the ESTIMATE, not a promise. A bar that fills in five minutes and then
 * sits at 100 % for five more is the specific lie users hate most, so this one is
 * capped short of the end (see `PROGRESS_CEILING`) and says "longer than usual"
 * out loud when the estimate is passed rather than pretending it was right.
 */

/** The estimate the bar fills against. Not a timeout — nothing is cancelled. */
export const RUN_ESTIMATE_MS = 10 * 60_000;

/**
 * ⭐ THE FLOOR OF THE RANGE THE UI QUOTES: "4 to 10 min".
 *
 * ⚠️ IT IS A LABEL, NOT A SECOND ESTIMATE — nothing computes against it. The bar
 * still fills against `RUN_ESTIMATE_MS` and still stops at `PROGRESS_CEILING`,
 * because the honest shape of this is one long estimate, not a two-point forecast.
 *
 * ⚠️ WHY QUOTE A FLOOR AT ALL. "10 min" alone reads as "this will take 10
 * minutes", so a run that finishes in four looks like a broken estimate and a run
 * at 3:18 looks a third done when it may be nearly finished. A range says the true
 * thing: most runs land somewhere in a window, and the number beside the clock is
 * not a countdown.
 */
export const RUN_ESTIMATE_MIN_MS = 4 * 60_000;

/**
 * ⚠️ THE BAR STOPS HERE, ON PURPOSE. Reaching 100 % while the run is still going
 * is worse than being slow: the next thing the user does is reload, and reloading
 * mid-run is how people convince themselves the product is broken.
 */
export const PROGRESS_CEILING = 0.97;

/**
 * ═══⭐⭐⭐ THE ESTIMATE EXTENDS ITSELF WHEN A RUN OUTLIVES IT ════════════════
 *
 * ⚠️⚠️ A SINGLE FIXED ESTIMATE HAS EXACTLY ONE FAILURE MODE, AND IT IS THE ONE
 * PEOPLE SEE. A run that passes ten minutes used to hit "Longer than usual" and
 * stay there — for another twenty minutes, with the bar frozen at 97 % and no
 * number moving. At that point the UI has stopped telling the user anything at
 * all, which is precisely when they reload or give up on the run.
 *
 * So the estimate is a LADDER, not a constant. Each rung says "once the run has
 * been going this long, the realistic remaining window is that long" — the number
 * beside the clock keeps moving, and the overrun copy is held back for a run that
 * is genuinely extraordinary rather than merely long.
 *
 * ⚠️ IT IS NOT A TIMEOUT AND NOTHING IS CANCELLED. Every number here is a label.
 * The run ends when the agent says it ends.
 *
 * ⚠️ THE LAST RUNG IS THE END OF THE LADDER. Past `45 min` the estimate stops
 * growing and `overrun` finally fires — a run that long IS longer than usual, and
 * saying so is the honest thing.
 *
 * ⚠️ THE `20 → 23` RUNG WAS SPECIFIED AS `20 → 13`. Taken literally it would SHORTEN
 * the estimate below the elapsed time, which flips the bar to overrun at the exact
 * moment it is supposed to be reassuring — and it is the only rung in an otherwise
 * strictly increasing ladder that goes backwards. Read as the transposition it plainly
 * is; if 13 really was meant, this table is the one place to change.
 */
const MINUTE = 60_000;

export interface EstimateRung {
    /** Once the run has been going this long… */
    atMs: number;
    /** …this is the estimate the UI quotes from then on. */
    estimateMs: number;
}

export const RUN_ESTIMATE_LADDER: EstimateRung[] = [
    { atMs: 8 * MINUTE, estimateMs: 12 * MINUTE },
    { atMs: 11 * MINUTE, estimateMs: 15 * MINUTE },
    { atMs: 14 * MINUTE, estimateMs: 18 * MINUTE },
    { atMs: 17 * MINUTE, estimateMs: 20 * MINUTE },
    { atMs: 20 * MINUTE, estimateMs: 23 * MINUTE },
    { atMs: 22 * MINUTE, estimateMs: 25 * MINUTE },
    { atMs: 24 * MINUTE, estimateMs: 29 * MINUTE },
    { atMs: 28 * MINUTE, estimateMs: 33 * MINUTE },
    { atMs: 31 * MINUTE, estimateMs: 35 * MINUTE },
    { atMs: 34 * MINUTE, estimateMs: 39 * MINUTE },
    { atMs: 38 * MINUTE, estimateMs: 42 * MINUTE },
    { atMs: 41 * MINUTE, estimateMs: 45 * MINUTE },
];

/** The estimate in force at `elapsedMs`, and the one it replaced (for the range copy). */
export function runEstimateAt(elapsedMs: number): { estimateMs: number; previousMs: number } {
    let estimateMs = RUN_ESTIMATE_MS;
    let previousMs = RUN_ESTIMATE_MIN_MS;

    for (const rung of RUN_ESTIMATE_LADDER) {
        if (elapsedMs < rung.atMs) break;
        previousMs = estimateMs;
        estimateMs = rung.estimateMs;
    }

    return { estimateMs, previousMs };
}

/**
 * ⭐⭐ THE CONTROL POINTS THE BAR IS INTERPOLATED OVER, AND WHY IT IS NOT SIMPLY
 * `elapsed / estimate`.
 *
 * ⚠️⚠️ EXTENDING AN ESTIMATE MOVES A NAIVE BAR BACKWARDS. At 7:59 the run is 80 %
 * of ten minutes; one second later the estimate is twelve and the same run is 67 %.
 * A progress bar that jumps back twelve points is read as an error, not as good
 * news, and it would happen at every one of the twelve rungs.
 *
 * ⚠️ AND A RUNNING MAX IS NOT THE FIX EITHER. Holding the previous value while the
 * new ratio catches up freezes the bar — nine flat minutes between 22 and 31, where
 * the ladder grows faster than the clock does. A frozen bar reads as a hang, which
 * is the thing this whole module exists to avoid.
 *
 * So the rungs are turned into a STRICTLY INCREASING sequence of ratios (each at
 * least `MIN_RATIO_STEP` above the last) and the bar interpolates linearly between
 * them. It never goes backwards, it never stops moving, it lands exactly on
 * `PROGRESS_CEILING` at the moment the ladder runs out, and at most rungs it is
 * within a point or two of the honest `elapsed / estimate`.
 */
const MIN_RATIO_STEP = 0.01;

const LADDER_POINTS: { atMs: number; ratio: number }[] = (() => {
    const points = [{ atMs: 0, ratio: 0 }];
    let ratio = 0;

    for (const rung of RUN_ESTIMATE_LADDER) {
        ratio = Math.min(PROGRESS_CEILING, Math.max(rung.atMs / rung.estimateMs, ratio + MIN_RATIO_STEP));
        points.push({ atMs: rung.atMs, ratio });
    }

    // The end of the ladder: the last estimate itself, where `overrun` takes over.
    const last = RUN_ESTIMATE_LADDER[RUN_ESTIMATE_LADDER.length - 1];
    points.push({ atMs: last.estimateMs, ratio: PROGRESS_CEILING });
    return points;
})();

function ladderRatio(elapsedMs: number): number {
    for (let index = 1; index < LADDER_POINTS.length; index++) {
        const from = LADDER_POINTS[index - 1];
        const to = LADDER_POINTS[index];
        if (elapsedMs >= to.atMs) continue;
        const span = to.atMs - from.atMs;
        const travelled = span > 0 ? (elapsedMs - from.atMs) / span : 1;
        return from.ratio + travelled * (to.ratio - from.ratio);
    }
    return PROGRESS_CEILING;
}

/**
 * ═══⭐ THE "STUCK" TEST ══════════════════════════════════════════════════════
 *
 * ⚠️ TWO CONDITIONS, AND BOTH ARE REQUIRED. Time alone is not evidence — a
 * twenty-minute run that is emitting a step every few seconds is simply a big
 * job, and telling that user to restart the server would throw away twenty
 * minutes of real work. What is NOT normal is a long run that has produced almost
 * no build steps: that is the signature of an agent server that came up wrong and
 * is sitting there with nothing to say.
 *
 * ⚠️ SO THE STEP COUNT IS THE REAL SIGNAL and the clock is only the confirmation.
 * Two steps is the threshold because one is what a healthy run emits immediately
 * and two can still be the tail of a stall; three means the agent is genuinely
 * working through something.
 */
export const STUCK_AFTER_MS = 15 * 60_000;
export const STUCK_MAX_STEPS = 2;

/** What we tell the user a restart costs. Matches `preview.restartDurationNotice`. */
export const RESTART_ESTIMATE_MINUTES = 3;

export interface RunProgress {
    /** 0…`PROGRESS_CEILING`. Never 1 while the run is alive. */
    ratio: number;
    /** The same, rounded, for the label and for `aria-valuenow`. */
    percent: number;
    /** The estimate has been passed — the bar stops and the copy changes. */
    overrun: boolean;
    /**
     * ⭐ THE ESTIMATE IN FORCE RIGHT NOW, which for a run is not a constant — see
     * `RUN_ESTIMATE_LADDER`. The label reads it from here rather than from
     * `RUN_ESTIMATE_MS`, so the number beside the clock and the bar underneath it can
     * never disagree.
     */
    estimateMs: number;
    /** The estimate this one replaced. The copy quotes "{previous} to {estimate}". */
    previousEstimateMs: number;
}

/**
 * ⚠️ THE SECOND ARGUMENT IS WHAT SEPARATES THE TWO CALLERS, AND THE DIFFERENCE IS
 * DELIBERATE.
 *
 * · **Omitted** — a chat run, whose length nobody can predict. It climbs the ladder.
 * · **Passed** — a publish, an import, a rebuild (`OPERATION_PROFILES`): bounded
 *   operations with their own measured estimate and their own banners. Those keep the
 *   original fixed-estimate arithmetic exactly as it was.
 */
export function runProgress(elapsedMs: number, estimateMs?: number): RunProgress {
    // A negative clock is a real case, not a hypothetical: a start time can come
    // off the wire from a machine whose clock is ahead of the browser's.
    const elapsed = Math.max(0, elapsedMs);

    if (typeof estimateMs === "number") {
        const overrun = elapsed >= estimateMs;
        const ratio = overrun ? PROGRESS_CEILING : Math.min(PROGRESS_CEILING, elapsed / estimateMs);
        return {
            ratio,
            percent: Math.round(ratio * 100),
            overrun,
            estimateMs,
            previousEstimateMs: estimateMs,
        };
    }

    const { estimateMs: current, previousMs } = runEstimateAt(elapsed);
    // ⚠️ Only once the LADDER is exhausted — the last rung's estimate is the only one
    // the clock can actually catch, because every earlier one steps out of the way.
    const overrun = elapsed >= current;
    const ratio = overrun ? PROGRESS_CEILING : Math.min(PROGRESS_CEILING, ladderRatio(elapsed));

    return {
        ratio,
        percent: Math.round(ratio * 100),
        overrun,
        estimateMs: current,
        previousEstimateMs: previousMs,
    };
}

export interface StuckInput {
    elapsedMs: number;
    /** `building` messages in the run so far. */
    stepCount: number;
    isRunning: boolean;
}

export function looksStuck({ elapsedMs, stepCount, isRunning }: StuckInput): boolean {
    if (!isRunning) return false;
    if (elapsedMs < STUCK_AFTER_MS) return false;
    return stepCount <= STUCK_MAX_STEPS;
}

/**
 * `m:ss`, and `h:mm:ss` once there is an hour on the clock.
 *
 * ⚠️ IT DOES NOT WRAP AT SIXTY MINUTES. A genuinely stuck run can sit for hours
 * before anyone looks at it, and `72:14` is both correct and immediately readable
 * as "over an hour" — but `1:12:14` is what a person would actually say, so past
 * the hour it gains the field rather than growing the minutes forever.
 */
export function formatDuration(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  WHERE THE START TIME COMES FROM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️⚠️ A RUN CLOCK THAT STARTS AT MOUNT IS WRONG AFTER EVERY RELOAD, and mid-run
 * reloads are common — the run takes twenty minutes and people go and look at
 * something else. `isRunning` is seeded from the project's `agentProcessStatus`,
 * so after a reload the workspace correctly knows a run is in flight and
 * incorrectly thinks it started just now.
 *
 * Three sources, in order of how much they can be trusted:
 *
 *   1. **The run's own `starting` message.** Server-side, exact, survives
 *      everything, and identical in every tab. This is the answer whenever the
 *      conversation has loaded.
 *   2. **A stamp this browser wrote when it saw the run begin.** Covers the gap
 *      before the conversation arrives, and the case where the message was trimmed
 *      out of a long history.
 *   3. **Now.** Honest last resort: the bar starts at zero rather than lying.
 */
export const MAX_PLAUSIBLE_RUN_MS = 6 * 60 * 60_000;

export interface ResolveRunStartInput {
    /** `createdAt` of the in-flight run's `starting` message, if there is one. */
    fromStream?: number | null;
    /** What this browser previously recorded for this project. */
    persisted?: number | null;
    now: number;
}

/**
 * ⚠️ IMPLAUSIBLE VALUES ARE DISCARDED, NOT CLAMPED. A stamp in the FUTURE (clock
 * skew between the sandbox and the browser) would render a negative elapsed, and a
 * stamp from days ago — a `localStorage` entry left behind by a run that ended
 * while the tab was closed — would open the chat claiming "4:12:57 elapsed" and
 * immediately declare the agent stuck. Both are rejected in favour of the next
 * source down.
 */
export function resolveRunStart({ fromStream, persisted, now }: ResolveRunStartInput): number {
    for (const candidate of [fromStream, persisted]) {
        if (typeof candidate !== "number" || !Number.isFinite(candidate)) continue;
        const elapsed = now - candidate;
        if (elapsed < 0 || elapsed > MAX_PLAUSIBLE_RUN_MS) continue;
        return candidate;
    }
    return now;
}

/** Per project, per browser. The key is namespaced like every other one here. */
export function runStartKey(projectId: string): string {
    return `totalum:run-start:${projectId}`;
}

export function readRunStart(projectId: string): number | null {
    try {
        const raw = window.localStorage.getItem(runStartKey(projectId));
        if (!raw) return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    } catch {
        // Private mode, or no storage at all. The clock falls back to `now`.
        return null;
    }
}

export function writeRunStart(projectId: string, at: number): void {
    try {
        window.localStorage.setItem(runStartKey(projectId), String(at));
    } catch {
        /* ignore */
    }
}

export function clearRunStart(projectId: string): void {
    try {
        window.localStorage.removeItem(runStartKey(projectId));
    } catch {
        /* ignore */
    }
}
