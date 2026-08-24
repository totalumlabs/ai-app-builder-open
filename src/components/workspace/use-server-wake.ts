"use client";

import * as React from "react";

import { isCachedPreview } from "@/lib/project-status";
import { vcaasApi } from "@/lib/vcaas";

/**
 * ═══ "YOUR SERVER IS WAKING UP" — PER FEATURE, NOT PER PAGE ═════════════════
 *
 * A project whose sandbox has been archived cannot be written to, rebuilt, published,
 * synced with GitHub or restored from a version. Every one of those endpoints now
 * answers the same way (`ensureServerActive` in account-backend): it **starts the
 * server itself**, charges it as a server start, and replies
 *
 *     409 { errorCode: "SERVER_NOT_READY", … poll agentServerStatus until "Active" }
 *
 * ⚠️⚠️ THAT REPLY IS CORRECT AND COMPLETELY USELESS ON ITS OWN. The work is already
 * under way; the caller just has to wait two to four minutes and ask again. Rendered
 * as `toast.error(response.error)` — which is what every one of these call sites did —
 * it reads as a failure, and the user's next move is to press the button again, which
 * spends another three credits on a server that is already starting.
 *
 * ── WHY THIS IS NOT `useProjectOperation` ───────────────────────────────────
 *
 * ⚠️ THE PROJECT-OPERATION SLOT IS DELIBERATELY GLOBAL: it paints a banner over the
 * preview, locks the chat composer, and refuses every other long action for as long as
 * it holds. That is right for a publish the user asked for. It is wrong for this —
 * waking the server is a PRECONDITION of the thing they asked for, not the thing
 * itself, and taking the whole workspace hostage over it would be a bigger
 * interruption than the wait. So this is a small local hook, and the loader it drives
 * renders inside whichever feature triggered it.
 *
 * ── THE CONTRACT ────────────────────────────────────────────────────────────
 *
 *     const wake = useServerWake(projectId);
 *     const response = await vcaasApi.deployments.deploy(projectId);
 *     if (wake.claim(response, () => void handleDeploy())) return;   // ← waking
 *     if (!response.ok) { …ordinary failure… }
 *
 * `claim` answers "was this the wake reply?". When it is, it starts polling and — once
 * the server is up — runs the callback, so the action the user actually pressed
 * happens without them pressing anything twice.
 */

/** The one code every auto-starting endpoint answers with. */
export const SERVER_NOT_READY = "SERVER_NOT_READY";

/**
 * ═══⭐⭐ "WHY DID NOTHING HAPPEN?" — THE REFUSAL HAS TO BE ANSWERED ═════════
 *
 * ⚠️⚠️ REPORTED: pressing Publish / Rebuild / Pull / Connect on a project whose sandbox
 * is archived or gone "does nothing". It was very nearly true. `claim` swallowed the
 * refusal and restarted the strip's clock, and the strip lives at the bottom of the
 * panel column — off-screen for someone who just pressed a button in the header. The
 * user's only feedback was a progress bar they were not looking at jumping back to zero.
 *
 * ⚠️ A DOM EVENT, NOT A PROP, and for the same reason `INSUFFICIENT_CREDITS` uses one:
 * there are FOUR live `useServerWake` instances (the shell, the GitHub modal, the code
 * panel, the diff viewer) and threading a dialog through each of them would be four
 * places to forget. One listener in the workspace answers every refusal in the app.
 *
 * ⚠️ IT FIRES ON EVERY REFUSAL, INCLUDING THE SECOND AND THIRD. Pressing the button
 * again while the server is still coming up is exactly when the explanation is needed.
 */
export const SERVER_WAKE_BLOCKED_EVENT = "totalum:server-wake-blocked";

/** How often we ask the project whether the server is back. */
const POLL_MS = 5_000;
/**
 * ⚠️ GENEROUS ON PURPOSE. Upstream quotes 2-4 minutes, but that figure is for a server
 * that is merely stopped. An ARCHIVED sandbox has to be unarchived at Clouding (polled
 * at 15 s intervals for up to 5 minutes), pass two SSH readiness gates, re-download its
 * source from GCS, `npm install` and run a full build. Ten minutes is the point past
 * which something has genuinely gone wrong, not the point at which it is slow.
 */
const TIMEOUT_MS = 10 * 60_000;

/**
 * ⭐⭐ THE ESTIMATE THE BAR FILLS AGAINST. Upstream quotes 2-4 minutes; a cold unarchive
 * runs longer, which is why the bar stops short of the end (`PROGRESS_CEILING`) and the
 * copy says "longer than usual" rather than pretending the estimate was right. Same
 * rule, and the same constant, as the agent run bar.
 */
export const WAKE_ESTIMATE_MS = 4 * 60_000;

/**
 * ═══⭐⭐⭐ THE WAIT SURVIVES A RELOAD ════════════════════════════════════════
 *
 * ⚠️⚠️ REPORTED: "on screen refresh it disappears". The whole state lived in React, so
 * refreshing during a two-to-four minute wake dropped the strip, the clock and the poll
 * — and the workspace then looked idle while the server was still coming up, which is
 * exactly the confusion this feature exists to remove. The server-side work never
 * stopped; only our knowledge of it did.
 *
 * ⚠️ THE STAMP IS THE START TIME, NOT A FLAG. A boolean would resurrect a strip for a
 * wake that finished while the tab was closed; a timestamp is checked against
 * `TIMEOUT_MS` on restore and discarded when it is too old to be real. Same rule as
 * `resolveRunStart` in `agent-progress.ts`.
 */
const wakeKey = (projectId: string) => `totalum:server-wake:${projectId}`;

function readWakeStart(projectId: string): number | null {
    try {
        const raw = window.localStorage.getItem(wakeKey(projectId));
        if (!raw) return null;
        const value = Number(raw);
        if (!Number.isFinite(value)) return null;
        const elapsed = Date.now() - value;
        // A stamp from the future (clock skew) or from a wake long finished is not a wake.
        if (elapsed < 0 || elapsed > TIMEOUT_MS) return null;
        return value;
    } catch {
        return null;
    }
}

function writeWakeStart(projectId: string, at: number | null): void {
    try {
        if (at === null) window.localStorage.removeItem(wakeKey(projectId));
        else window.localStorage.setItem(wakeKey(projectId), String(at));
    } catch {
        /* private mode — the wait still works, it just will not survive a reload. */
    }
}

export interface ServerWake {
    /** True while we are waiting for the sandbox to come back. */
    waking: boolean;
    /** How long we have been waiting, for the loader's clock. */
    elapsedMs: number;
    /** The wait ended without the server coming up. */
    failed: boolean;
    /**
     * ⭐ WILL THE ACTION REPLAY ITSELF? One hook serves several actions in the shell —
     * publish and pull replay, a version restore cannot — and the strip they share has
     * to say the right thing about the one currently waiting. False means the copy asks
     * the user to try again rather than promising to do it for them.
     */
    willRetry: boolean;
    /**
     * Inspect a VCaaS response. Returns `true` when it was `SERVER_NOT_READY` — the
     * caller should stop and render the notice; the retry is handled here.
     */
    claim: (
        response: { ok: boolean; code?: string | null; upstreamCode?: string | null },
        onReady?: () => void,
        /**
         * ⚠️ `silent` IS FOR THE ONE CALLER THE USER DID NOT PRESS — the workspace's
         * automatic start on opening an archived project. Explaining "this action needs
         * the server" to somebody who has not asked for an action would be a dialog in
         * the face of every visit to a sleeping project.
         */
        options?: { silent?: boolean }
    ) => boolean;
    /**
     * Enter the waiting state without a refusal to inspect.
     *
     * ⚠️ FOR THE CALLER THAT STARTED THE SERVER ON PURPOSE — the workspace does this on
     * opening an archived project, where `start-or-restart` answers `200 { starting }`
     * and there is no `SERVER_NOT_READY` for `claim` to recognise. The wait is identical
     * from here on; only the way it began differs.
     */
    begin: (onReady?: () => void) => void;
    /** Drop the notice (a dismiss, or the feature closing). */
    reset: () => void;
}

export function useServerWake(projectId: string): ServerWake {
    const [startedAt, setStartedAt] = React.useState<number | null>(null);
    const [elapsedMs, setElapsedMs] = React.useState(0);
    const [failed, setFailed] = React.useState(false);
    // ⚠️ State, not the ref below: the strip's copy depends on it, so it must render.
    const [willRetry, setWillRetry] = React.useState(false);

    /**
     * ⚠️ THE CALLBACK LIVES IN A REF, NOT IN STATE. It is captured when the action
     * fails and fired minutes later; putting it in state would re-run the polling
     * effect on every render that produced a new closure, and restart the clock.
     */
    const onReadyRef = React.useRef<(() => void) | null>(null);
    const mounted = React.useRef(true);

    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    /**
     * ⚠️ RESTORED IN AN EFFECT, NOT IN `useState`. Reading `localStorage` during render
     * disagrees between the server pass and hydration, and React throws the markup away.
     * The strip appearing one frame late is the correct trade.
     *
     * ⚠️ `willRetry` STAYS FALSE ON A RESTORE, and that is honest rather than lazy: the
     * callback that would have replayed the action died with the previous page. The copy
     * therefore asks the user to try again, which is exactly what they will have to do.
     */
    React.useEffect(() => {
        if (!projectId) return;
        const restored = readWakeStart(projectId);
        if (restored === null) return;
        setStartedAt(restored);
        setElapsedMs(Date.now() - restored);
    }, [projectId]);

    const reset = React.useCallback(() => {
        onReadyRef.current = null;
        setWillRetry(false);
        setStartedAt(null);
        setElapsedMs(0);
        setFailed(false);
        writeWakeStart(projectId, null);
    }, [projectId]);

    /**
     * ⚠️⚠️ THE CLOCK IS NEVER RESTARTED BY A SECOND CALLER — see `startedAtRef`. A wake
     * that began ninety seconds ago is ninety seconds old no matter how many features
     * discover it afterwards.
     */
    const startedAtRef = React.useRef<number | null>(null);
    startedAtRef.current = startedAt;

    const enter = React.useCallback(
        (onReady?: () => void) => {
            onReadyRef.current = onReady ?? null;
            setWillRetry(!!onReady);
            setFailed(false);
            // Already waiting: keep the original start, adopt only the new callback.
            if (startedAtRef.current !== null) return;
            setElapsedMs(0);
            const at = Date.now();
            setStartedAt(at);
            writeWakeStart(projectId, at);
        },
        [projectId]
    );

    const begin = React.useCallback((onReady?: () => void) => enter(onReady), [enter]);

    const claim = React.useCallback(
        (
            response: { ok: boolean; code?: string | null; upstreamCode?: string | null },
            onReady?: () => void,
            options?: { silent?: boolean }
        ): boolean => {
            /**
             * ⚠️⚠️ `upstreamCode`, NOT `code`, AND CHECKING ONLY `code` MADE EVERY ONE OF
             * THESE INTEGRATIONS DEAD IN PRODUCTION.
             *
             * `VcaasErrorCode` is a STABLE, DELIBERATELY SMALL union — `INSUFFICIENT_CREDITS`,
             * `PLAN_REQUIRED`, `PROJECT_NOT_FOUND`, `RATE_LIMITED`, `VALIDATION`,
             * `UPLOAD_QUOTA_EXCEEDED`, `UNKNOWN`. Anything VCaaS invents that is not on that
             * list normalises to `code: "UNKNOWN"` and keeps its real name in `upstreamCode`.
             * `SERVER_NOT_READY` is one of those, so `claim` never matched, and every caller
             * fell through to `toast.error(response.error)` — which is how a user pressing
             * Publish got the raw API sentence *"Server is already starting (status:
             * Unarchiving). … Poll GET /projects/landing-mockup …"* in a corner toast.
             *
             * ⚠️ BOTH ARE CHECKED, so this keeps working if the code is ever promoted into
             * the stable union.
             */
            const upstream = response.upstreamCode ?? response.code;
            if (response.ok || upstream !== SERVER_NOT_READY) return false;
            /**
             * ⚠️⚠️ THIS USED TO RESTART THE CLOCK ON EVERY REFUSAL, and that was the
             * whole of the reported bug: pressing Publish twice on a sleeping project
             * sent the strip's timer and progress bar back to 0:00 — telling the user
             * their wait had just begun when it was two minutes old — and produced no
             * other visible response at all. `enter` keeps the original start.
             */
            enter(onReady);
            // ⭐ AND SAY SO. The strip alone is not an answer to a button press; see
            // `SERVER_WAKE_BLOCKED_EVENT`.
            if (!options?.silent && typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent(SERVER_WAKE_BLOCKED_EVENT));
            }
            return true;
        },
        [enter]
    );

    // ── The clock ─────────────────────────────────────────────────────────
    React.useEffect(() => {
        if (startedAt === null) return;
        setElapsedMs(Date.now() - startedAt);
        const timer = setInterval(() => {
            if (mounted.current) setElapsedMs(Date.now() - startedAt);
        }, 1_000);
        return () => clearInterval(timer);
    }, [startedAt]);

    // ── The poll ──────────────────────────────────────────────────────────
    React.useEffect(() => {
        if (startedAt === null) return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const poll = async () => {
            if (cancelled) return;

            /**
             * ⚠️ NO SECOND TIMEOUT LIVES HERE ANY MORE. The wait used to run for ten
             * minutes before giving up; the `WAKE_ESTIMATE_MS` cap below now always ends
             * it first, so a `TIMEOUT_MS` branch here could only ever be dead code
             * pretending to be a safety net. `TIMEOUT_MS` still has one real job — see
             * `readWakeStart`, which uses it to reject a stamp too old to be a live wake.
             */
            const detail = await vcaasApi.projects.get(projectId);
            if (cancelled || !mounted.current) return;

            /**
             * ═══⭐⭐⭐ WHEN THE WAIT IS ACTUALLY OVER ════════════════════════════
             *
             * ⚠️⚠️ `Active` ON ITS OWN WAS TOO EARLY, AND THE GAP IS MINUTES WIDE. The
             * sandbox reports `Active` as soon as the machine is up; the app inside it
             * is still installing and building. Upstream knows this and says so —
             * `developmentUrlFieldToUse` keeps recommending the ARCHIVE SNAPSHOT until
             * it has fetched the live url and seen a real page. So the strip vanished,
             * the user was told their server was ready, and the preview went on showing
             * a stale copy of their app. The wait now ends when the project itself says
             * the url to show is the live one — the exact same test the preview uses to
             * swap the frame (`isCachedPreview`), so the strip and the preview can never
             * again disagree about whether the project is back.
             *
             * ⚠️ AND IT IS CAPPED, BECAUSE A SIGNAL THAT MAY NEVER ARRIVE MUST NOT BE A
             * GATE. A project whose build is broken never serves a real page, so the
             * recommendation never flips. Past `WAKE_ESTIMATE_MS` (the same four minutes
             * the bar fills against) we stop waiting either way: with the server up, the
             * pending action is replayed exactly as before, because at that point it
             * genuinely will be accepted; without it, the strip switches to the "taking
             * longer than expected" line rather than spinning for another six minutes.
             */
            const active = detail.ok && detail.data?.agentServerStatus === "Active";
            const serving = active && !isCachedPreview(detail.data);
            const overrun = Date.now() - startedAt >= WAKE_ESTIMATE_MS;

            if (serving || overrun) {
                const onReady = onReadyRef.current;
                onReadyRef.current = null;
                writeWakeStart(projectId, null);
                setWillRetry(false);
                setStartedAt(null);
                setElapsedMs(0);
                // Out of time with nothing running: say so instead of going quiet.
                if (!active) {
                    setFailed(true);
                    return;
                }
                // ⚠️ AFTER the state is cleared, so the retry sees a settled hook and
                // can `claim` again if the server went down between poll and retry.
                onReady?.();
                return;
            }

            timer = setTimeout(poll, POLL_MS);
        };

        timer = setTimeout(poll, POLL_MS);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [startedAt, projectId]);

    /**
     * ⚠️ MEMOISED, AND THAT IS LOAD-BEARING. Consumers put this object in the
     * dependency array of their own `useCallback`s (`DiffViewer`'s `load` is
     * `[source, wake]`). A fresh object literal every render made those callbacks
     * unstable, which re-ran the effects that depend on them on every render — and
     * one of those effects calls `setState`, so the result was an infinite render
     * loop (React #185) the moment the workspace mounted. Keyed on the real values
     * only, so identity changes exactly when the wake state does.
     */
    return React.useMemo(
        () => ({ waking: startedAt !== null, elapsedMs, failed, willRetry, claim, begin, reset }),
        [startedAt, elapsedMs, failed, willRetry, claim, begin, reset]
    );
}
