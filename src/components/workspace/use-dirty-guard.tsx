"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/primitives";
import { useT } from "@/i18n";

/**
 * "You have unsaved changes" — for modals that hold a half-filled form.
 *
 * ── WHY THIS IS A HOOK AND NOT A `Modal` PROP ───────────────────────────────
 *
 * Only the modal's own content knows whether it is dirty (a typed secret value, a
 * hostname mid-edit, a pasted GitHub token). Pushing that into the `Modal`
 * primitive would mean every modal carrying dirty-tracking it does not need.
 *
 * ── WHAT COUNTS AS DIRTY ────────────────────────────────────────────────────
 *
 * ⚠️ Only work that would be LOST. Reading a list is not dirty; a typed-but-unsaved
 * GitHub token is. Over-reporting dirtiness trains people to dismiss the
 * confirmation, which is worse than not having one — so each modal decides
 * narrowly, and none of them treat "I opened this" as a change.
 *
 * ⚠️ **NEVER PAIR THIS WITH `dismissible={false}`.** That prop makes `Modal`
 * `preventDefault()` the ESC and overlay events, so Radix never calls
 * `onOpenChange` — and this guard, which works by intercepting exactly that call,
 * never runs. The modal then swallows Escape in silence. Caught in the browser:
 * pressing Escape on a half-typed GitHub token did nothing at all. Use the guard
 * OR `dismissible`, never both.
 *
 * Usage:
 *   const guard = useDirtyGuard(hasUnsavedInput, () => setOpen(false));
 *   <Modal open={open} onOpenChange={guard.onOpenChange}>
 *     …
 *   {guard.confirmDialog}   // a sibling of the Modal, not a child
 */
export interface DirtyGuard {
    /** Pass to `Modal.onOpenChange` — intercepts a close while dirty. */
    onOpenChange: (open: boolean) => void;
    /** Render inside the modal (or anywhere) — the confirmation itself. */
    confirmDialog: React.ReactNode;
    /** Close immediately, bypassing the guard (after a successful save). */
    closeNow: () => void;
}

export function useDirtyGuard(isDirty: boolean, close: () => void): DirtyGuard {
    const t = useT();
    const [confirming, setConfirming] = React.useState(false);

    // Hold `close` in a ref so the returned handlers stay referentially stable and
    // do not re-trigger effects in the modals that consume them.
    const closeRef = React.useRef(close);
    closeRef.current = close;

    const onOpenChange = React.useCallback(
        (open: boolean) => {
            if (open) return;
            if (isDirty) {
                setConfirming(true);
                return;
            }
            closeRef.current();
        },
        [isDirty]
    );

    const closeNow = React.useCallback(() => {
        setConfirming(false);
        closeRef.current();
    }, []);

    const confirmDialog = (
        <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            tone="danger"
            title={t("workspace.unsavedTitle")}
            description={t("workspace.unsavedDescription")}
            confirmLabel={t("workspace.unsavedDiscard")}
            cancelLabel={t("workspace.unsavedKeepEditing")}
            onConfirm={closeNow}
        />
    );

    return { onOpenChange, confirmDialog, closeNow };
}
