"use client";

import * as React from "react";
import {
    clearOperation,
    CLOCK_SKEW_GRACE_MS,
    OPERATION_PROFILES,
    operationStorageKey,
    readOperation,
    writeOperation,
    type ProjectOperation,
    type ProjectOperationKind,
} from "@/lib/project-operation";

/**
 * ═══ THE ONE OPERATION A PROJECT IS BUSY WITH ═══════════════════════════════
 *
 * The React half of `@/lib/project-operation`: which long operation is in flight,
 * how long it has been going, and the three verbs that change that.
 *
 * ── WHAT IT OWNS AND WHAT IT DOES NOT ───────────────────────────────────────
 *
 * ⚠️ IT DOES NOT POLL ANYTHING. Watching an operation to its end needs the project,
 * the toasts, the preview frame and the conversation — all of which live in
 * `WorkspaceShell`, which has exactly one generic watcher keyed on `operation`. This
 * hook is the state and the clock; the shell is the machine.
 *
 * ── THE CLOCK IS DERIVED FROM `startedAt`, NEVER COUNTED UP ─────────────────
 *
 * ⚠️ `elapsed + 1` EVERY SECOND IS WRONG IN THREE ORDINARY SITUATIONS: a background
 * tab (timers are throttled to once a minute), a sleeping laptop, and a reload. All
 * three make a counted-up clock read LOWER than the truth, which is the specific way
 * a progress bar becomes a lie — it would show 40 s elapsed on a publish that has
 * been running for three minutes. `Date.now() - startedAt` is right in all three.
 *
 * ── TWO TABS ────────────────────────────────────────────────────────────────
 *
 * ⭐ THE `storage` EVENT KEEPS THEM IN STEP. Publishing in one tab and watching the
 * other one accept a prompt — which the sandbox would then run against source that is
 * being built — was possible before and is not now. The event fires only in the OTHER
 * tabs, which is exactly the ones that do not already know.
 */

export interface UseProjectOperationResult {
    /** The operation in flight, or `null`. */
    operation: ProjectOperation | null;
    kind: ProjectOperationKind | null;
    /** `Date.now() - startedAt`, ticking once a second. `0` when nothing is running. */
    elapsedMs: number;
    /**
     * Record the start of one. Replaces whatever was there — the caller gates that.
     *
     * ⚠️ `startedAt` IS FOR THE ONE OPERATION THE SERVER DATES ITSELF. A version
     * recovery reports `versionRecovery.startedAt`, which beats this browser's clock:
     * it is the same value in every tab and on every device, and it is right for a
     * recovery somebody else started. Everything else stamps `Date.now()`, because
     * nothing upstream tells us when it began.
     */
    begin: (kind: ProjectOperationKind, startedAt?: number) => void;
    /**
     * Clear it.
     *
     * ⚠️ IT NAMES THE KIND, and a mismatch is a no-op. A watcher that settles late —
     * after its operation was superseded — must not clear the banner of the operation
     * that replaced it.
     */
    end: (kind: ProjectOperationKind) => void;
    /**
     * "The server says this is happening." Keeps an existing stamp of the same kind
     * (its `startedAt` is more accurate than now), replaces one of a different kind
     * (server truth beats a local stamp), and starts one if there is nothing.
     *
     * ⚠️ A SERVER-SUPPLIED `startedAt` OVERRIDES EVEN A MATCHING STAMP, because then
     * it is not a guess: our stamp says when this browser found out, and the server's
     * says when the work began.
     */
    adopt: (kind: ProjectOperationKind, startedAt?: number) => void;
    /** Reads the CURRENT value from a ref — safe inside async callbacks and effects. */
    isActive: (kind: ProjectOperationKind) => boolean;
    /**
     * The current operation, read from the ref rather than from render state.
     *
     * ⚠️⚠️ THIS IS WHAT LONG-LIVED CLOSURES MUST USE. The workspace's initial-load
     * effect is keyed on `projectId` alone and therefore captures its variables on the
     * FIRST render — before this hook's restore effect has run, when `operation` is
     * still `null`. Reading the state value there would mean a restored operation is
     * invisible to exactly the code that has to reconcile it with the server.
     */
    current: () => ProjectOperation | null;
}

export function useProjectOperation(projectId: string): UseProjectOperationResult {
    const [operation, setOperation] = React.useState<ProjectOperation | null>(null);
    const [elapsedMs, setElapsedMs] = React.useState(0);

    /**
     * ⚠️ A MIRROR FOR THE ASYNC PATHS. `begin`/`end`/`adopt` are called from inside
     * awaited handlers and from timers; reading `operation` there is the classic
     * stale-closure bug, and here it would mean a watcher clearing a banner that
     * belongs to something else.
     */
    const operationRef = React.useRef<ProjectOperation | null>(null);

    const apply = React.useCallback((next: ProjectOperation | null) => {
        operationRef.current = next;
        setOperation(next);
    }, []);

    /**
     * ⚠️ RESTORED IN AN EFFECT, NEVER DURING RENDER. Reading `localStorage` while
     * rendering would produce different markup on the server (no storage) and the
     * client, which is a hydration mismatch on the most-loaded page in the product.
     */
    React.useEffect(() => {
        apply(readOperation(projectId));
    }, [projectId, apply]);

    /** Another tab started or finished one — see the note at the top. */
    React.useEffect(() => {
        const key = operationStorageKey(projectId);

        const onStorage = (event: StorageEvent) => {
            if (event.key !== null && event.key !== key) return;
            // `null` key = storage was cleared wholesale; re-read either way.
            apply(readOperation(projectId));
        };

        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, [projectId, apply]);

    // The clock. Its own interval so a poll's timing never drags the display's.
    React.useEffect(() => {
        if (!operation) {
            setElapsedMs(0);
            return;
        }

        const startedAt = operation.startedAt;
        const tick = () => setElapsedMs(Date.now() - startedAt);
        // Immediately, so a restored operation never paints a 0:00 it has passed.
        tick();

        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [operation]);

    const begin = React.useCallback(
        (kind: ProjectOperationKind, startedAt?: number) => {
            /**
             * ⚠️ AN IMPLAUSIBLE SERVER TIME IS IGNORED RATHER THAN TRUSTED. A start
             * time far in the future (clock skew) renders a clock counting backwards,
             * and one older than this kind's own patience would restore a banner that
             * `parseOperation` would refuse on the very next reload — an operation that
             * exists in this tab and nowhere else.
             */
            const usable =
                typeof startedAt === "number" &&
                Number.isFinite(startedAt) &&
                Date.now() - startedAt <= OPERATION_PROFILES[kind].timeoutMs &&
                Date.now() - startedAt >= -CLOCK_SKEW_GRACE_MS;

            const next: ProjectOperation = {
                kind,
                startedAt: usable ? (startedAt as number) : Date.now(),
            };
            writeOperation(projectId, next);
            apply(next);
        },
        [projectId, apply]
    );

    const end = React.useCallback(
        (kind: ProjectOperationKind) => {
            const current = operationRef.current;
            if (current && current.kind !== kind) return;

            clearOperation(projectId);
            apply(null);
        },
        [projectId, apply]
    );

    const adopt = React.useCallback(
        (kind: ProjectOperationKind, startedAt?: number) => {
            if (operationRef.current?.kind === kind && startedAt === undefined) return;
            begin(kind, startedAt);
        },
        [begin]
    );

    const isActive = React.useCallback(
        (kind: ProjectOperationKind) => operationRef.current?.kind === kind,
        []
    );

    const current = React.useCallback(() => operationRef.current, []);

    return {
        operation,
        kind: operation?.kind ?? null,
        elapsedMs,
        begin,
        end,
        adopt,
        isActive,
        current,
    };
}
