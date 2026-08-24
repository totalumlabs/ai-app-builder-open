import type { TranslationKey } from "@/i18n/types";

/**
 * ═══ EXPORT · IMPORT · CLONE (Feature H8) ═══════════════════════════════════
 *
 * The rules behind the three transfer flows, kept out of the components so the
 * credit arithmetic and the error mapping can be tested without a browser.
 *
 * ── THE CALLING SEQUENCE, FROM THE OFFICIAL REFERENCE ───────────────────────
 *
 *   export : POST …/{source}/export   → { importCode }        2 credits
 *   create : POST /projects                                    1 credit
 *   import : POST …/{target}/import   → returns IMMEDIATELY    6 credits
 *   poll   : GET  /projects/{target}  until agentServerStatus = "Active"
 *
 * ⚠️ IMPORT IS ASYNC AND THE 200 MEANS "STARTED", NOT "DONE". The restore and
 * rebuild take minutes after the call returns. A UI that closes on the response
 * would tell the user their clone is ready while it is still an empty project.
 *
 * ⚠️ BOTH ENDPOINTS ARE RATE-LIMITED TO 1/MINUTE AND 5/HOUR. Nothing here may
 * auto-retry: one failed export retried three times burns the minute limit and
 * turns a recoverable error into `PROJECT_EXPORT_LIMIT_REACHED`.
 *
 * Pure module: no React, no fetch. Unit-tested by `src/lib/__tests__/transfer.test.ts`.
 */

/** Credit costs, from `VCAAS_CREDIT_COSTS` (CONTEXT §4.10). */
export const TRANSFER_COSTS = {
    export: 2,
    /** Creating the destination project is a real, separate charge. */
    createProject: 1,
    import: 6,
} as const;

/**
 * ⭐ A CLONE COSTS **NINE** CREDITS, NOT EIGHT.
 *
 * ⚠️ The brief says "be honest that a clone costs both operations" — but it is
 * three operations, not two. A clone must CREATE the destination project before
 * it can import into it, and `CREATE_PROJECT` is 1 credit. Quoting 2 + 6 = 8
 * would under-state the price of the flow users reach for most, which is exactly
 * the kind of small dishonesty that erodes trust in a credit balance.
 */
export const CLONE_COST =
    TRANSFER_COSTS.export + TRANSFER_COSTS.createProject + TRANSFER_COSTS.import;

/**
 * ⚠️⚠️ THE IN-DIALOG POLL IS GONE, AND SO ARE ITS TWO CONSTANTS.
 *
 * `IMPORT_POLL_MS` / `IMPORT_TIMEOUT_MS` used to watch the target project from
 * inside the import and clone dialogs for up to twelve minutes. That put the whole
 * progress of an import in a modal's React state, which **died on reload** — refresh
 * mid-clone and there was no loader, no explanation, and a workspace that looked idle
 * over a project being rebuilt underneath it.
 *
 * Both dialogs now hand off the moment `POST …/import` returns 200: they stamp the
 * new project's operation slot and navigate to it, and the workspace's import overlay
 * takes over. That overlay is driven by `project.importInProgress` — a lock held and
 * dated by the SERVER — so it survives a reload, a second tab and another device.
 *
 * ⚠️ THE TIMING NOW LIVES IN ONE PLACE: `OPERATION_PROFILES.import` in
 * `@/lib/project-operation`. Do not reintroduce a second set of numbers here; a poll
 * interval and a give-up window that disagree with the workspace's are exactly how
 * two parts of the product start telling different stories about one import.
 */

/** The phases a transfer moves through. Drives the progress UI. */
export type TransferPhase =
    | "idle"
    | "exporting"
    | "creating"
    | "importing"
    | "waiting"
    | "done"
    | "failed"
    | "timeout";

/** Which phases are still working — used to lock the dialog and show a spinner. */
export function isBusyPhase(phase: TransferPhase): boolean {
    return (
        phase === "exporting" ||
        phase === "creating" ||
        phase === "importing" ||
        phase === "waiting"
    );
}

/**
 * ⭐ HAS A PROJECT BEEN CREATED BY THIS POINT?
 *
 * The brief: "if an import fails partway, say clearly whether a partial project
 * was created." That question has a definite answer and the UI must not guess —
 * everything from `importing` onwards means the destination EXISTS, is charged
 * for, and is sitting in the user's project list whether the import finished or
 * not. Failing during `exporting` or `creating` leaves nothing behind.
 */
export function hasCreatedProject(phase: TransferPhase, createdSlug: string | null): boolean {
    if (!createdSlug) return false;
    return phase === "importing" || phase === "waiting" || phase === "done" ||
        phase === "failed" || phase === "timeout";
}

/**
 * Step labels for the combined clone progress view.
 *
 * ⚠️⚠️ THE `waiting` STEP IS GONE FROM THIS RAIL, AND `TransferPhase` KEEPS IT.
 * The dialog's job now ends the moment `POST …/import` returns 200 — it stamps the
 * new project and navigates, and the workspace's import overlay shows the build.
 * A fourth row here would therefore be a step the user watches never light up
 * before the dialog disappears out from under it.
 *
 * The PHASE survives because it is still a meaningful position in the sequence:
 * `hasCreatedProject` and `phaseIndex` reason about it, and it is what an import
 * that is genuinely still being watched somewhere would be in.
 */
export const CLONE_STEPS: { phase: TransferPhase; labelKey: TranslationKey }[] = [
    { phase: "exporting", labelKey: "transfer.step.exporting" },
    { phase: "creating", labelKey: "transfer.step.creating" },
    { phase: "importing", labelKey: "transfer.step.importing" },
];

const PHASE_ORDER: TransferPhase[] = ["idle", "exporting", "creating", "importing", "waiting", "done"];

/** Where a phase sits in the sequence — for ticking off completed steps. */
export function phaseIndex(phase: TransferPhase): number {
    const index = PHASE_ORDER.indexOf(phase);
    // Terminal failures sit at the end so every prior step still reads as done.
    if (index === -1) return PHASE_ORDER.length - 1;
    return index;
}

export function isStepComplete(step: TransferPhase, current: TransferPhase): boolean {
    if (current === "failed" || current === "timeout") return false;
    return phaseIndex(current) > phaseIndex(step);
}

/**
 * ⭐ UPSTREAM ERROR CODE → A MESSAGE THAT SAYS WHAT TO DO NEXT.
 *
 * ⚠️ EVERY ONE OF THESE IS ACTIONABLE, because a transfer error that only says
 * "failed" leaves the user with a half-charged operation and no idea whether to
 * retry, wait, or top up. The codes are the ones the official reference
 * documents for these two endpoints — nothing invented.
 */
const ERROR_KEYS: Record<string, TranslationKey> = {
    PROJECT_EXPORT_LIMIT_REACHED: "transfer.error.exportRateLimited",
    PROJECT_IMPORT_LIMIT_REACHED: "transfer.error.importRateLimited",
    INSUFFICIENT_CREDITS: "transfer.error.insufficientCredits",
    PROJECT_NOT_FOUND: "transfer.error.projectNotFound",
    MISSING_IMPORT_CODE: "transfer.error.missingCode",
    PROJECT_NOT_IMPORTABLE: "transfer.error.notImportable",
    IMPORT_IN_PROGRESS: "transfer.error.importInProgress",
    AGENT_RUNNING: "transfer.error.agentRunning",
    /**
     * ⭐ THE TARGET'S SERVER IS ASLEEP. An import restores and rebuilds ON the sandbox,
     * so VCaaS starts it and refuses this call — the work is already under way and the
     * only thing to do is wait and press Retry, which this dialog already offers. It is
     * not an error the user caused, and the copy must not read like one.
     */
    SERVER_NOT_READY: "transfer.error.serverNotReady",
    PROJECT_ALREADY_EXISTS: "transfer.error.nameTaken",
    RATE_LIMIT_EXCEEDED: "transfer.error.createRateLimited",
    /**
     * ⭐ THE ACCOUNT'S PROJECT CEILING. A duplicate and an import BOTH create a
     * project first, so both hit this — and it is the one failure in this list
     * that Retry can never clear. The copy has to say so, or a user presses the
     * button this dialog is showing them until they give up.
     */
    MAX_PROJECTS_REACHED: "transfer.error.projectLimitReached",
};

/**
 * The translation key for an upstream failure, or `null` when we have no
 * specific advice and should show the server's own message instead.
 */
export function errorKeyFor(code: string | null | undefined): TranslationKey | null {
    if (!code) return null;
    return ERROR_KEYS[code] ?? null;
}

/**
 * Does an import code look like one?
 *
 * ⚠️ DELIBERATELY LOOSE, and validating BEFORE spending anything is the point:
 * the brief asks the import flow to "validate it before doing anything". The
 * real codes look like `<project>-export-project-<32 hex>.zip`, but that shape
 * is upstream's to change, so this only rejects what is obviously not a code —
 * empty, whitespace-bearing, absurdly short or long, or a pasted URL. A code we
 * wave through is judged by the server; a valid code we reject is a dead end.
 */
export function looksLikeImportCode(value: string): boolean {
    const code = value.trim();
    if (code.length < 12 || code.length > 400) return false;
    if (/\s/.test(code)) return false;
    if (/^https?:\/\//i.test(code)) return false;
    return true;
}

/**
 * Suggest a name for a copy: `my-app` → `my-app-copy`, then `-copy-2`, `-copy-3`.
 *
 * ⚠️ IT RESPECTS THE 35-CHARACTER SLUG LIMIT by trimming the BASE, not the
 * suffix — `a-very-long-name-copy` is useful, `a-very-long-name-co` is not a
 * copy of anything. Trailing hyphens are stripped so the result stays a legal
 * slug (`^[a-z]([a-z0-9]|-(?!-))*(?<!-)$`).
 */
export function suggestCopyName(source: string, taken: ReadonlySet<string> = new Set()): string {
    const MAX = 35;

    const build = (suffix: string): string => {
        const room = MAX - suffix.length;
        const base = source.slice(0, Math.max(1, room)).replace(/-+$/, "");
        return `${base}${suffix}`;
    };

    let candidate = build("-copy");
    if (!taken.has(candidate)) return candidate;

    for (let n = 2; n < 100; n += 1) {
        candidate = build(`-copy-${n}`);
        if (!taken.has(candidate)) return candidate;
    }
    return candidate;
}
