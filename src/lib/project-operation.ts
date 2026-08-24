/**
 * ═══ THE ONE LONG-RUNNING PROJECT OPERATION ═════════════════════════════════
 *
 * Four things a user can start in a workspace take MINUTES, run on the sandbox
 * rather than in the tab, and leave the project in a state where prompting would
 * conflict with the work already in flight:
 *
 *   · **publish**        — a production build against the current source (2-4 min);
 *   · **rebuild**        — a cold rebuild of the dev server (1-4 min);
 *   · **githubPull**     — remote source overwrites local source (1-3 min);
 *   · **restartServer**  — the dev server goes down and comes back (2-4 min);
 *   · **restoreVersion** — a past snapshot overwrites the project's files (1-4 min).
 *
 * Before this module each one had its own flag, its own poll, its own copy and its
 * own idea of what the rest of the workspace should be allowed to do — which is why
 * a publish disabled the visual editor but not the chat, and why a restart lost its
 * loader on every page reload. There is now ONE slot: a project is either doing one
 * of these things or it is not, and everything that has to react — the banner over
 * the preview, the composer lock, the refusal on every other long action — reads
 * that single fact.
 *
 * ── WHY ONE SLOT AND NOT A SET ──────────────────────────────────────────────
 *
 * ⚠️ THEY GENUINELY CANNOT OVERLAP, AND THE SERVER AGREES. Every one of them rewrites
 * the project's files or replaces its running server; two at once is a race whose
 * outcome is a broken build, not an error message. VCaaS enforces this itself —
 * `checkConflictingOperation` answers `409 AGENT_RUNNING` / `DEPLOYMENT_RUNNING` /
 * `RECOVERY_RUNNING` — so the second one is REFUSED here (see `blocked` in the copy
 * below) rather than queued, and what the UI prevents is an error the API would
 * return anyway. The UI never has to describe two operations at the same time.
 *
 * ── WHY IT IS PERSISTED ─────────────────────────────────────────────────────
 *
 * ⚠️⚠️ THE WORK CONTINUES WITHOUT THE TAB. All four endpoints return immediately
 * and do the work in a background task on the sandbox, so a reload — or a second
 * tab, or a laptop lid — does not stop anything. The old build kept the fact in
 * `useState` alone, which meant a reload during a restart produced a workspace that
 * looked idle while the server was down: no banner, no explanation, a composer that
 * accepted a prompt the sandbox could not run. `localStorage` is what makes the
 * banner and the lock survive a reload.
 *
 * ⚠️ IT IS NOT THE ONLY SOURCE. Where the server can answer "is this happening"
 * (`deployment.status === "deploying"`, `rebuild/status`, `github/pull-status`) that
 * answer WINS — see `adopt` in `use-project-operation.ts`. The stamp is what carries
 * the START TIME (which no endpoint reports) and covers `restartServer`, which has
 * no server-side signal at all.
 *
 * ── EVERYTHING HERE IS PURE ─────────────────────────────────────────────────
 *
 * The React side lives in `use-project-operation.ts`. Keeping the arithmetic and the
 * parsing here is what makes the two claims that are expensive to get wrong testable
 * (`npm run test:operations`): the bar never says "finished" while work continues,
 * and a stale stamp never resurrects a banner nobody can dismiss.
 */

import type { TranslationKey } from "@/i18n";
import { runProgress, type RunProgress } from "./agent-progress";

export const PROJECT_OPERATION_KINDS = [
    "publish",
    "rebuild",
    "githubPull",
    "restartServer",
    "restoreVersion",
    /**
     * ⭐ A PROJECT IMPORT — a template link, a manual import, or a clone.
     *
     * ⚠️ IT BELONGS IN THIS SLOT AND NOT IN A SYSTEM OF ITS OWN. It is the same
     * shape as the five above: minutes long, server-side, destructive to the
     * project's files, and refused upstream while anything else is running. Every
     * guarantee this module already provides — the derived clock, cross-tab sync,
     * the chat lock, the "no permanent banner" timeout — is exactly what an import
     * needs, and a parallel implementation would be a second chance to get each of
     * them wrong.
     *
     * ⚠️ WHAT MAKES IT DIFFERENT IS THE **UI**, NOT THE STATE. It is the only kind
     * that paints a blocking full-screen overlay rather than a banner, because
     * during an import there is genuinely nothing to look at or do: the files are
     * being replaced wholesale and the preview shows the wrong app. See
     * `ImportOverlay.tsx`.
     *
     * ⚠️ AND IT IS THE ONLY ONE WITH A DURABLE SERVER-SIDE SIGNAL. `GET /projects/:id`
     * reports `importInProgress`, so — unlike a restart, which only this browser
     * knows about — a reload, a second tab and another device all agree. The stamp
     * below is only a first-paint optimisation for the tab that started it.
     */
    "import",
] as const;

export type ProjectOperationKind = (typeof PROJECT_OPERATION_KINDS)[number];

export interface ProjectOperation {
    kind: ProjectOperationKind;
    /** Epoch ms, from the browser that started it. */
    startedAt: number;
}

/** What a watcher settled on. `unknown` = we stopped being able to tell. */
export type ProjectOperationOutcome = "success" | "error" | "stalled";

export interface ProjectOperationProfile {
    /**
     * ⚠️ THE TWO NUMBERS THE USER IS TOLD, and they are told BOTH. "About 3 minutes"
     * is a single number people read as a deadline and then distrust; "2 to 4
     * minutes" is a range, which is what this actually is.
     */
    minMinutes: number;
    maxMinutes: number;
    /**
     * What the progress bar fills against — the TOP of the range, never the middle.
     * A bar that reaches its ceiling at the optimistic estimate spends the rest of
     * the operation looking stuck.
     */
    estimateMs: number;
    /**
     * ⚠️⚠️ THE BANNER CAN NEVER BE PERMANENT. Past this the watcher gives up, the
     * operation is cleared and the user is told we stopped watching. Without it, one
     * upstream job that never reports its outcome locks the chat of that project for
     * ever — including across reloads, because the stamp would keep being restored.
     */
    timeoutMs: number;
    /** How often to ask whether it has finished. */
    pollMs: number;
}

/**
 * ⚠️ THE POLL INTERVALS AND TIMEOUTS ARE THE ONES THE SEPARATE IMPLEMENTATIONS
 * ALREADY USED — 10 s for a deploy, 8 s for a rebuild, 5 s for a pull, 4 s for a
 * restart, 8 minutes of patience for a restart and 10 for a rebuild. This module
 * unifies WHERE they live, not what they are; changing them was not part of the job.
 */
export const OPERATION_PROFILES: Record<ProjectOperationKind, ProjectOperationProfile> = {
    publish: {
        minMinutes: 2,
        maxMinutes: 4,
        estimateMs: 4 * 60_000,
        timeoutMs: 15 * 60_000,
        pollMs: 10_000,
    },
    rebuild: {
        minMinutes: 1,
        maxMinutes: 4,
        estimateMs: 4 * 60_000,
        timeoutMs: 10 * 60_000,
        pollMs: 8_000,
    },
    githubPull: {
        minMinutes: 1,
        maxMinutes: 3,
        estimateMs: 3 * 60_000,
        timeoutMs: 10 * 60_000,
        pollMs: 5_000,
    },
    restartServer: {
        minMinutes: 2,
        maxMinutes: 4,
        estimateMs: 4 * 60_000,
        timeoutMs: 8 * 60_000,
        pollMs: 4_000,
    },
    /**
     * ⚠️ "1-4 MINUTES" IS UPSTREAM'S OWN NUMBER, quoted from the 409 it returns while
     * one is running: *"Recoveries take 1-4 minutes — poll GET /projects/:projectId
     * until `versionRecovery` is null"*. The poll interval matches the rebuild's
     * because the probe is the same weight (one project read).
     */
    restoreVersion: {
        minMinutes: 1,
        maxMinutes: 4,
        estimateMs: 4 * 60_000,
        timeoutMs: 10 * 60_000,
        pollMs: 8_000,
    },
    /**
     * ⭐ AN IMPORT IS THE LONGEST OF THE SIX, AND THE COPY HAS TO SAY SO.
     *
     * It restores a whole database, sets up the source, installs dependencies and
     * does a cold build — a version restore's work plus a first build's. Quoting a
     * publish's "2 to 4 minutes" would have people reloading in the middle of a
     * perfectly healthy import, which is the single most likely way to make one look
     * broken.
     *
     * ⚠️⚠️ THE TIMEOUT IS 30 MINUTES BECAUSE **UPSTREAM'S IS**. totalum-backend
     * treats an import lock older than `IMPORT_LOCK_TIMEOUT_MS` (30 min) as dead and
     * account-backend then reports `importInProgress: null`. Giving up sooner would
     * paint "we stopped watching" over an import the engine still considers live and
     * is still blocking prompts for; giving up later would outlive the only signal
     * that can ever clear it. The two numbers must move together.
     */
    import: {
        minMinutes: 3,
        maxMinutes: 8,
        estimateMs: 8 * 60_000,
        timeoutMs: 30 * 60_000,
        pollMs: 8_000,
    },
};

export interface ProjectOperationCopy {
    /** The banner's headline — "Publishing your project". */
    title: TranslationKey;
    /** The banner's second line: how long, and that the chat comes back by itself. */
    description: TranslationKey;
    /** Inside the locked composer. Short — it sits in a 76px box. */
    chatLock: TranslationKey;
    /** The toast when someone clicks the locked composer anyway. */
    chatLockToast: TranslationKey;
    /** The refusal shown when ANOTHER long action is attempted during this one. */
    blocked: TranslationKey;
    /** Announced on a clean finish. */
    succeeded: TranslationKey;
    /** Announced when upstream reports failure. */
    failed: TranslationKey;
    /** Announced when we time out or lose track of it — never phrased as failure. */
    stalled: TranslationKey;
}

/**
 * ⚠️ WRITTEN OUT RATHER THAN BUILT FROM A TEMPLATE. `workspace.operation.${kind}.title`
 * would typecheck and would also silently accept a kind whose copy nobody wrote;
 * spelled out, a missing key is a compile error in the dictionary that owns it.
 */
export const OPERATION_COPY: Record<ProjectOperationKind, ProjectOperationCopy> = {
    publish: {
        title: "workspace.operation.publish.title",
        description: "workspace.operation.publish.description",
        chatLock: "workspace.operation.publish.chatLock",
        chatLockToast: "workspace.operation.publish.chatLockToast",
        blocked: "workspace.operation.publish.blocked",
        succeeded: "workspace.deploy.succeeded",
        failed: "workspace.deploy.failed",
        stalled: "workspace.operation.publish.stalled",
    },
    rebuild: {
        title: "workspace.operation.rebuild.title",
        description: "workspace.operation.rebuild.description",
        chatLock: "workspace.operation.rebuild.chatLock",
        chatLockToast: "workspace.operation.rebuild.chatLockToast",
        blocked: "workspace.operation.rebuild.blocked",
        succeeded: "workspace.code.rebuildDone",
        failed: "workspace.code.rebuildFailed",
        stalled: "workspace.operation.rebuild.stalled",
    },
    githubPull: {
        title: "workspace.operation.githubPull.title",
        description: "workspace.operation.githubPull.description",
        chatLock: "workspace.operation.githubPull.chatLock",
        chatLockToast: "workspace.operation.githubPull.chatLockToast",
        blocked: "workspace.operation.githubPull.blocked",
        succeeded: "workspace.github.pullSucceeded",
        failed: "workspace.github.pullFailed",
        stalled: "workspace.operation.githubPull.stalled",
    },
    restartServer: {
        title: "workspace.operation.restartServer.title",
        description: "workspace.operation.restartServer.description",
        chatLock: "workspace.operation.restartServer.chatLock",
        chatLockToast: "workspace.operation.restartServer.chatLockToast",
        blocked: "workspace.operation.restartServer.blocked",
        succeeded: "workspace.preview.restartReady",
        failed: "workspace.preview.restartSlow",
        stalled: "workspace.preview.restartSlow",
    },
    restoreVersion: {
        title: "workspace.operation.restoreVersion.title",
        description: "workspace.operation.restoreVersion.description",
        chatLock: "workspace.operation.restoreVersion.chatLock",
        chatLockToast: "workspace.operation.restoreVersion.chatLockToast",
        blocked: "workspace.operation.restoreVersion.blocked",
        succeeded: "workspace.versions.restored",
        failed: "workspace.versions.restoreFailed",
        stalled: "workspace.operation.restoreVersion.stalled",
    },
    import: {
        title: "workspace.operation.import.title",
        description: "workspace.operation.import.description",
        chatLock: "workspace.operation.import.chatLock",
        chatLockToast: "workspace.operation.import.chatLockToast",
        blocked: "workspace.operation.import.blocked",
        succeeded: "workspace.operation.import.succeeded",
        failed: "workspace.operation.import.failed",
        stalled: "workspace.operation.import.stalled",
    },
};

// ═══════════════════════════════════════════════════════════════════════════
//  PROGRESS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * How full the bar is, against this kind's own estimate.
 *
 * ⚠️ IT IS `runProgress`, THE SAME FUNCTION THE CHAT'S RUN BAR USES — including its
 * 97 % ceiling and its `overrun` flag. A second implementation would be a second
 * chance to ship a bar that reaches 100 % while the work continues, which is the
 * one thing that makes people reload in the middle of a publish.
 */
export function operationProgress(kind: ProjectOperationKind, elapsedMs: number): RunProgress {
    return runProgress(elapsedMs, OPERATION_PROFILES[kind].estimateMs);
}

// ═══════════════════════════════════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

/** Per project, per browser — namespaced like every other key in this app. */
export function operationStorageKey(projectId: string): string {
    return `totalum:project-op:${projectId}`;
}

/**
 * ⚠️ A STAMP FROM THE FUTURE IS TOLERATED UP TO A MINUTE, NOT BEYOND. The sandbox
 * and the browser disagree about the clock by seconds, and rejecting a stamp for
 * being 300 ms ahead would drop a banner the user just asked for. A minute out is no
 * longer skew, it is a broken clock, and believing it would render a bar that counts
 * backwards.
 */
export const CLOCK_SKEW_GRACE_MS = 60_000;

export function isOperationKind(value: unknown): value is ProjectOperationKind {
    return (
        typeof value === "string" &&
        (PROJECT_OPERATION_KINDS as readonly string[]).includes(value)
    );
}

/**
 * Parse what was stored, and REFUSE anything that would lie to the user.
 *
 * ⚠️⚠️ EXPIRY IS ENFORCED HERE, NOT ONLY IN THE WATCHER. A tab closed mid-publish
 * and reopened a week later must not restore that publish: the operation would
 * paint a banner, lock the chat, and start polling an endpoint whose answer settled
 * days ago. The window is the kind's OWN timeout — exactly as long as a watcher
 * would have been willing to keep waiting, and not one second longer.
 */
export function parseOperation(raw: string | null | undefined, now: number): ProjectOperation | null {
    if (!raw) return null;

    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        return null;
    }

    if (!value || typeof value !== "object") return null;

    const { kind, startedAt } = value as { kind?: unknown; startedAt?: unknown };
    if (!isOperationKind(kind)) return null;
    if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return null;

    const elapsed = now - startedAt;
    if (elapsed < -CLOCK_SKEW_GRACE_MS) return null;
    if (elapsed > OPERATION_PROFILES[kind].timeoutMs) return null;

    return { kind, startedAt };
}

export function serializeOperation(operation: ProjectOperation): string {
    return JSON.stringify({ kind: operation.kind, startedAt: operation.startedAt });
}

/** `true` once the watcher has waited longer than this kind deserves. */
export function isOperationExpired(operation: ProjectOperation, now: number): boolean {
    return now - operation.startedAt > OPERATION_PROFILES[operation.kind].timeoutMs;
}

// ═══════════════════════════════════════════════════════════════════════════
//  WHOSE DEPLOYMENT IS THAT?
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ═══⭐⭐ THE HARDEST QUESTION IN A PUBLISH ══════════════════════════════════
 *
 * `GET …/deployments/status` describes the project's LATEST deployment, and it has no
 * idea which one the user is currently waiting for. `POST …/deploy` returns before the
 * new deployment row exists, so for the first seconds afterwards that endpoint still
 * answers `success` — about the PREVIOUS publish.
 *
 * ⚠️⚠️ BELIEVING IT IS A LIE THE USER ACTS ON. The banner disappears, the chat
 * unlocks, and "your project is live" opens with an address serving the version from
 * before the build that is still running. Two independent code paths hit this — the
 * poll, and the reload-time reconciliation — so the rule lives here, in one place,
 * with tests.
 *
 * ⚠️ `unknown` IS A REAL ANSWER AND BOTH CALLERS DEPEND ON IT. When the payload
 * carries no usable date we know nothing: the reload path must NOT retire the stamp
 * (it would drop a banner for work still in flight) and the poll must NOT discard the
 * status (it would ignore the only answer it is going to get). Each takes the safe
 * side of its own decision, which is only possible because this does not guess.
 */
export type DeploymentAge = "ours" | "earlier" | "unknown";

export function classifyDeploymentAge(
    createdAt: string | null | undefined,
    operationStartedAt: number
): DeploymentAge {
    if (!createdAt) return "unknown";

    const created = Date.parse(createdAt);
    if (!Number.isFinite(created)) return "unknown";

    /**
     * ⚠️ THE GRACE IS NOT OPTIONAL. `operationStartedAt` is stamped by the browser and
     * `createdAt` by the sandbox; without it, our own deployment — created a fraction of
     * a second after the click, on a clock a few seconds behind — reads as "earlier",
     * and a publish would report as never registering.
     */
    return created < operationStartedAt - CLOCK_SKEW_GRACE_MS ? "earlier" : "ours";
}

// ═══════════════════════════════════════════════════════════════════════════
//  IS THE SANDBOX REBUILDING BEHIND OUR BACK?
// ═══════════════════════════════════════════════════════════════════════════

/** What `GET …/rebuild/status` answers. `idle` = nothing has ever rebuilt here. */
export type RebuildStatus = "idle" | "rebuilding" | "success" | "error";

/**
 * ═══⭐⭐ THE RELOAD THAT LANDS IN THE MIDDLE OF A REBUILD ════════════════════
 *
 * ⚠️⚠️ A MANUAL EDIT CAN START A REBUILD THAT THIS BROWSER HAS NO STAMP FOR, and
 * that is the whole reason this exists. The stamp is written by the tab that pressed
 * the button — so a rebuild started by the VISUAL EDITOR's apply (which the server
 * kicks off for you), by a second tab, by a teammate, or in a browser whose storage
 * has since been cleared, leaves the workspace looking completely idle while the dev
 * server is being replaced underneath it. The user sees no banner, gets no
 * explanation for a preview that is half-dead, and can send a prompt that races the
 * build. `rebuild/status` is the server-side answer, and asking it once on load is
 * what makes the "applying your changes" state survive a reload.
 *
 * ⚠️ IT ONLY EVER *ADDS* AN OPERATION, NEVER REPLACES ONE. A publish or a version
 * restore already in the slot outranks this: both rewrite the project wholesale, the
 * server refuses a concurrent rebuild anyway, and clobbering their stamp would lose
 * the START TIME their banner is counting from. An existing REBUILD stamp is left
 * alone for the same reason — it knows when the work began and this does not.
 *
 * ⚠️ AND IT NEVER RETIRES ONE. A `success`/`error` reading on load is deliberately
 * NOT treated as "clear the banner": the generic watcher polls the same endpoint a
 * few seconds later, settles on the same answer, and — unlike this — TELLS the user
 * how it went. Silently unlocking on a failed build is how someone ends up with a
 * broken preview and no idea why.
 */
export function shouldAdoptServerRebuild(
    status: RebuildStatus | string | null | undefined,
    current: ProjectOperation | null
): boolean {
    return status === "rebuilding" && current === null;
}

export function readOperation(projectId: string, now: number = Date.now()): ProjectOperation | null {
    try {
        return parseOperation(window.localStorage.getItem(operationStorageKey(projectId)), now);
    } catch {
        // Private mode, or no storage at all: the operation simply does not survive
        // a reload, which is the pre-existing behaviour rather than a new failure.
        return null;
    }
}

export function writeOperation(projectId: string, operation: ProjectOperation): void {
    try {
        window.localStorage.setItem(operationStorageKey(projectId), serializeOperation(operation));
    } catch {
        /* ignore */
    }
}

export function clearOperation(projectId: string): void {
    try {
        window.localStorage.removeItem(operationStorageKey(projectId));
    } catch {
        /* ignore */
    }
}
