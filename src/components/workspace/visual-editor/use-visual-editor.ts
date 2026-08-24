"use client";

import * as React from "react";

import { VISUAL_EDIT_MESSAGE } from "@/lib/visual-edit-agent";
import type { ElementSignature, VisualChange, VisualChangeKind } from "@/lib/visual-edit";

/**
 * ═══ THE VISUAL EDITOR STORE (Feature F12) ══════════════════════════════════
 *
 * Owns the conversation with the in-page agent and the list of unsaved changes.
 *
 * ⚠️ EVERY MESSAGE IS ORIGIN-CHECKED. The agent runs inside a document the preview
 * proxy serves from THIS origin, so `event.origin === window.location.origin` is the
 * whole test — and it is checked on the way in as well as pinned on the way out. No
 * `postMessage(..., "*")` anywhere.
 *
 * ⚠️ CHANGES ARE PREVIEW-ONLY UNTIL APPLY. Each one is pushed to the agent
 * immediately (so the user sees it at once) AND kept here with its `before` value,
 * which is what makes per-change undo and discard-all possible without a reload.
 */

export interface SelectedElement {
    signature: ElementSignature;
    editable: { text: boolean; media: boolean };
    computed: { color: string; backgroundColor: string; fontSize: string };
}

export type ApplyPhase = "idle" | "applying" | "rebuilding" | "done" | "error";

export interface ApplyOutcome {
    applied: { changeId: string; filePath: string; confident: boolean }[];
    unmapped: { changeId: string; reason: string; occurrences: number }[];
    filesWritten: number;
    rebuildStarted: boolean;
    rebuildCode?: string | null;
    billing?: { charged: boolean; amount: number; reason: string };
    /**
     * G5 — which tier placed each change: `exact` (the build's own source tags),
     * `structural`, `data`, `legacy`. Diagnostic only; the bar does not render it, but
     * it is the difference between "the editor is guessing" and "the editor was told".
     */
    engine?: {
        exact: number;
        structural: number;
        data: number;
        legacy: number;
        sourceTagged: boolean;
        parsed: boolean;
    };
}

/**
 * Pull a palette out of an agent message, defensively.
 *
 * ⚠️ THE AGENT'S PAYLOAD IS UNTRUSTED SHAPE, not untrusted origin. It crosses a
 * `postMessage` boundary from a document whose build we do not control, so every
 * value is re-validated here rather than spread into state — a malformed entry would
 * otherwise reach `<input type="color">`, which silently falls back to black.
 */
function readPalette(payload: unknown): string[] {
    const raw = (payload as { palette?: unknown } | null)?.palette;
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((value): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value))
        .slice(0, 12);
}

/**
 * `Array.prototype.findLastIndex` without the ES2023 lib requirement.
 *
 * ⚠️ SEARCHING FROM THE END IS THE POINT, not a micro-optimisation: an element can
 * appear in the list more than once (edited, undone, edited again), and only the
 * MOST RECENT entry is the one whose `after` is the value now on screen.
 */
function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
    for (let index = items.length - 1; index >= 0; index--) {
        if (predicate(items[index])) return index;
    }
    return -1;
}

export function useVisualEditor({
    projectId,
    iframeRef,
    enabled,
}: {
    projectId: string;
    iframeRef: React.RefObject<HTMLIFrameElement | null>;
    enabled: boolean;
}) {
    /** Bumped on every agent `ready`. `> 0` means connected — see the ready case. */
    const [readyTick, setReadyTick] = React.useState(0);
    const ready = readyTick > 0;
    const [selected, setSelected] = React.useState<SelectedElement | null>(null);
    /**
     * G4 — the colours the previewed project ACTUALLY uses, harvested from the
     * rendered page by the agent and ordered by how often each appears. The picker
     * offers these before it offers a hex field, because a colour the design already
     * uses is nearly always the one the user wants.
     */
    const [palette, setPalette] = React.useState<string[]>([]);
    const [changes, setChanges] = React.useState<VisualChange[]>([]);
    const [phase, setPhase] = React.useState<ApplyPhase>("idle");
    const [outcome, setOutcome] = React.useState<ApplyOutcome | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    /** Synchronous double-apply guard — see `apply()` (G3/M3). */
    const inFlight = React.useRef(false);

    /**
     * ⚠️ THE MESSAGE LISTENER IS MOUNTED ONCE, so it cannot read `selected` or call
     * `pushChange` directly — it would capture whatever they were at mount and hold
     * those forever. Re-subscribing on every change instead would tear the listener
     * down and rebuild it on every keystroke. Refs are the way a permanent listener
     * reads current values.
     */
    const selectedRef = React.useRef<SelectedElement | null>(null);
    const pushTextRef = React.useRef<
        (before: string, after: string, signature: ElementSignature) => void
    >(() => {});

    const post = React.useCallback(
        (type: string, payload?: unknown) => {
            const frame = iframeRef.current;
            if (!frame?.contentWindow) return;
            // ⚠️ EXPLICIT ORIGIN, NEVER "*" — the frame is same-origin by construction.
            frame.contentWindow.postMessage({ type, payload }, window.location.origin);
        },
        [iframeRef]
    );

    React.useEffect(() => {
        selectedRef.current = selected;
    }, [selected]);

    // ── Listen to the agent ───────────────────────────────────────────────
    React.useEffect(() => {
        function onMessage(event: MessageEvent) {
            if (event.origin !== window.location.origin) return;
            /**
             * ⚠️ G3/N7 — THE SOURCE, NOT ONLY THE ORIGIN. Same-origin is already fully
             * trusted, so this is hardening rather than a fix for a live hole: it pins
             * the conversation to the preview frame so no other window on this origin
             * (another iframe, an opener, a stray widget) can drive the editor. G2
             * drove the entire store by posting from the top window; it cannot now.
             */
            if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
            const data = event.data as { type?: string; payload?: unknown };
            if (!data?.type?.startsWith("totalum:ve:")) return;

            switch (data.type) {
                case VISUAL_EDIT_MESSAGE.ready:
                    /**
                     * ⚠️ G3/M5 — A COUNTER, NOT A BOOLEAN, AND THAT IS THE WHOLE FIX.
                     *
                     * The agent re-announces after every preview reload — including the
                     * one this editor triggers itself once a rebuild finishes. With a
                     * boolean, `setReady(true)` on an already-true state does not
                     * re-render, the `setActive` effect never re-runs, and selection
                     * mode is silently dead: the panel looks connected and clicking the
                     * page does nothing. Bumping a counter makes every announcement a
                     * state change, so the effect below re-arms the agent every time.
                     */
                    setReadyTick(tick => tick + 1);
                    setPalette(readPalette(data.payload));
                    break;
                /**
                 * ⭐ G4 — THE PALETTE ALONE, WITHOUT BUMPING `readyTick`. The agent
                 * re-harvests on activation; routing that through `ready` made the
                 * effect below post `setActive` again, which made the agent re-harvest
                 * again, 120+ times in two seconds. See the message's own note.
                 */
                case VISUAL_EDIT_MESSAGE.palette:
                    setPalette(readPalette(data.payload));
                    break;
                case VISUAL_EDIT_MESSAGE.selected:
                    setSelected(data.payload as SelectedElement);
                    break;
                /**
                 * ⭐ THE USER TYPED IN THE PAGE, NOT IN THE PANEL.
                 *
                 * ⚠️ IT GOES THROUGH THE SAME `pushChange` AS THE TEXTAREA, and that
                 * is the whole design: one code path means the unsaved-changes bar,
                 * the collapse rule, per-change undo and the apply request cannot
                 * behave differently depending on where the letters were typed.
                 *
                 * ⚠️ THE AGENT'S ECHO IS HARMLESS. `pushChange` posts the change
                 * back as an `apply`, which for text the agent skips when the DOM
                 * already says it — otherwise rewriting the node would drop the
                 * caret to position 0 mid-word.
                 */
                case VISUAL_EDIT_MESSAGE.textEdited: {
                    const edit = data.payload as { before?: unknown; after?: unknown };
                    if (typeof edit?.before !== "string" || typeof edit?.after !== "string") break;
                    // `selectedRef`, not `selected`: this listener is mounted once and
                    // would otherwise close over the selection as it was at mount.
                    const current = selectedRef.current;
                    if (!current) break;
                    pushTextRef.current(edit.before, edit.after, current.signature);
                    break;
                }
                case VISUAL_EDIT_MESSAGE.cleared:
                    setSelected(null);
                    break;
                case VISUAL_EDIT_MESSAGE.navigated:
                    /**
                     * ⚠️ A NAVIGATION DISCARDS THE PENDING CHANGES, and it has to.
                     * The agent applied them to nodes that no longer exist, so keeping
                     * them in the bar would promise an undo we could not honour and an
                     * apply whose `before` values no longer describe the page.
                     */
                    setSelected(null);
                    setChanges([]);
                    setPalette(readPalette(data.payload));
                    break;
            }
        }

        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, []);

    /**
     * Turn selection mode on and off with the panel.
     *
     * ⭐ G4 — `done` AND `error` COUNT AS IDLE, and leaving them out made the editor
     * look broken. The outcome strip stays on screen until it is dismissed, and while it
     * did, this posted `setActive(false)`: clicking anything in the preview did nothing.
     * Measured — an apply that could not place its change left the editor dead, and the
     * only way back was a Dismiss button the user had no reason to connect to it.
     *
     * Only a write actually in flight should disarm selection, because only then would
     * a new selection race the batch being written.
     */
    const busy = phase === "applying" || phase === "rebuilding";

    React.useEffect(() => {
        if (readyTick === 0) return;
        post(VISUAL_EDIT_MESSAGE.setActive, enabled && !busy);
    }, [enabled, readyTick, busy, post]);

    /** Push a change to the preview AND record it as unsaved. */
    const pushChange = React.useCallback(
        (
            kind: VisualChangeKind,
            before: string,
            after: string,
            signature: ElementSignature,
            /** ⭐ G6 — set only by the upload dropzone; see `VisualChange.uploaded`. */
            options?: { uploaded?: boolean }
        ) => {
            if (before === after) return;
            const id = `ve-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const prop = kind === "class" ? "class" : kind === "src" ? "src" : "text";

            post(VISUAL_EDIT_MESSAGE.apply, { id, target: "selected", prop, value: after });

            setChanges(current => {
                /**
                 * ⚠️ CONSECUTIVE EDITS TO THE SAME PROPERTY OF THE SAME ELEMENT ARE
                 * COLLAPSED, keeping the ORIGINAL `before`. Typing a heading letter by
                 * letter would otherwise produce thirty entries in the bar and thirty
                 * file edits — and the second one's `before` would no longer exist in
                 * the source, so it could never be resolved.
                 */
                /**
                 * ⚠️ G3/M4 — KEYED ON `selectionId`, NOT ON THE BREADCRUMB.
                 *
                 * The breadcrumb is built from the element's FIRST CLASS, and a size or
                 * colour edit rewrites exactly that — so `h1.text-4xl` became
                 * `h1.text-5xl` and the collapse never fired. Measured in G2: three A+
                 * presses produced three separate changes, two of which had a `before`
                 * that no longer existed in the source and were reported unmappable.
                 * `selectionId` is minted by the agent per selection and survives every
                 * edit to the element, which is precisely what this needs.
                 *
                 * ⚠️⚠️ IT SEARCHES THE WHOLE LIST, NOT JUST THE LAST ENTRY, AND THAT
                 * IS A REPORTED BUG.
                 *
                 * `current[current.length - 1]` only collapses edits made back to back.
                 * Edit A, then B, then A again — the ordinary way anyone actually works
                 * — produced a THIRD change whose `before` is A's value after the first
                 * edit, a string that exists in no source file. It could never be
                 * resolved, and the user was told "we couldn't find that" about an edit
                 * they were looking at:
                 *
                 *     unmapped: [ { reason: "not-found", occurrences: 0 } × 4 ]
                 *
                 * Matching the most recent change for THIS element instead means an
                 * element's chain collapses to one edit no matter what was touched in
                 * between: the `before` stays the value that is genuinely in the source
                 * and the `after` is wherever the user has got to.
                 *
                 * The `after === before` half stays: it is what proves this edit
                 * continues that chain rather than being a re-edit after an undo.
                 */
                const index = findLastIndex(
                    current,
                    candidate =>
                        candidate.kind === kind &&
                        candidate.signature.selectionId === signature.selectionId &&
                        candidate.after === before
                );

                if (index !== -1) {
                    const merged = [...current];
                    merged[index] = { ...current[index], after, id: current[index].id };
                    return merged;
                }
                return [...current, { id, kind, signature, before, after, uploaded: options?.uploaded }];
            });
        },
        [post]
    );

    React.useEffect(() => {
        pushTextRef.current = (before, after, signature) =>
            pushChange("text", before, after, signature);
    }, [pushChange]);

    const undoChange = React.useCallback(
        (id: string) => {
            post(VISUAL_EDIT_MESSAGE.revert, { id });
            setChanges(current => current.filter(change => change.id !== id));
        },
        [post]
    );

    const discardAll = React.useCallback(() => {
        for (const change of changes) post(VISUAL_EDIT_MESSAGE.revert, { id: change.id });
        setChanges([]);
        // G3/P2 — tell the agent to drop its outline too. Clearing React state alone
        // left the blue ring sitting on an element the panel no longer described.
        post(VISUAL_EDIT_MESSAGE.deselect);
        setSelected(null);
    }, [changes, post]);

    /** Resolve, write, rebuild. The editor stays locked until this settles. */
    const apply = React.useCallback(async () => {
        if (changes.length === 0) return;
        /**
         * ⚠️⚠️ G3/M3 — A REF, NOT THE PHASE, IS WHAT MAKES THIS SAFE.
         *
         * `setPhase("applying")` is asynchronous, so two clicks in the same tick both
         * pass a phase check and both POST. G2 measured exactly that: two requests,
         * three changes each — two file writes and two rebuilds, the second refused
         * with REBUILD_RUNNING and surfaced as a generic failure over a successful
         * apply. A ref flips synchronously, which is the only thing that can win a
         * race inside one tick. The button is also disabled, but that is the polish;
         * this is the guard.
         */
        if (inFlight.current) return;
        inFlight.current = true;

        setPhase("applying");
        setError(null);
        setOutcome(null);

        try {
            const response = await fetch(`/api/visual-edit/${encodeURIComponent(projectId)}/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ changes }),
            });
            const payload = (await response.json()) as {
                ok?: boolean;
                code?: string;
                data?: ApplyOutcome;
            };

            if (!payload.ok || !payload.data) {
                setError(payload.code || "APPLY_FAILED");
                setPhase("error");
                return;
            }

            setOutcome(payload.data);

            // Only the changes that genuinely landed leave the bar; the rest stay so
            // the user can see what was refused and why.
            const appliedIds = new Set(payload.data.applied.map(item => item.changeId));
            setChanges(current => current.filter(change => !appliedIds.has(change.id)));

            setPhase(payload.data.rebuildStarted ? "rebuilding" : "done");
        } catch {
            /**
             * ⚠️ G3/M2 — "NETWORK" IS NOT "NOTHING WAS WRITTEN". The request may well
             * have written files and started a rebuild before the connection dropped,
             * so this maps to its own honest message rather than the reassuring one.
             */
            setError("NETWORK");
            setPhase("error");
        } finally {
            inFlight.current = false;
        }
    }, [changes, projectId]);

    /**
     * G3/P1 — this used to send `setActive: true`, which clears nothing (the agent only
     * clears on `setActive: false`). It sends the dedicated `deselect` message.
     *
     * ⚠️ `useCallback`, because G4's Escape ladder depends on it: an inline arrow here
     * is a new function on every render, which would tear down and re-attach the
     * keydown listener continuously.
     */
    const clearSelection = React.useCallback(() => {
        post(VISUAL_EDIT_MESSAGE.deselect);
        setSelected(null);
    }, [post]);

    const finishRebuild = React.useCallback(() => setPhase("done"), []);
    /**
     * G3/B5 — the rebuild ended badly. Releases the lock (which the old code did) AND
     * says so (which it did not: `error` was treated exactly like `success`, so a
     * failed rebuild silently reloaded the frame into a broken app).
     */
    const failRebuild = React.useCallback((code: string) => {
        setError(code);
        setPhase("error");
    }, []);
    const reset = React.useCallback(() => {
        setPhase("idle");
        setOutcome(null);
        setError(null);
    }, []);

    return {
        ready,
        selected,
        palette,
        changes,
        phase,
        outcome,
        error,
        pushChange,
        undoChange,
        discardAll,
        apply,
        finishRebuild,
        failRebuild,
        reset,
        clearSelection,
    };
}
