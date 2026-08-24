"use client";

import * as React from "react";
import { Modal } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { ServerWakeNotice } from "./ServerWakeNotice";
import { SERVER_WAKE_BLOCKED_EVENT, type ServerWake } from "./use-server-wake";

/**
 * ═══⭐⭐ THE ONE DIALOG THAT ANSWERS EVERY REFUSED ACTION ═══════════════════
 *
 * ⚠️⚠️ EVERY ACTION THAT TOUCHES THE SANDBOX — publish, rebuild, GitHub pull, restore a
 * version, save a file, edit visually — is REFUSED outright while the project's server is
 * archived or gone. VCaaS starts the server itself and answers `SERVER_NOT_READY`, which
 * is a correct instruction to a program and nothing at all to the person who pressed
 * Publish: without this dialog the entire visible result of the click is a progress strip
 * somewhere else on the page.
 *
 * ⚠️ IT LISTENS FOR AN EVENT RATHER THAN TAKING A PROP, and that is what makes it
 * modular: `useServerWake` dispatches `SERVER_WAKE_BLOCKED_EVENT` from wherever the
 * refusal happened, so a panel with its OWN wake instance (the code editor, the diff
 * viewer, a modal) is answered by this one mount with no wiring at all. Drop it once in
 * the workspace and every present and future refusal is covered.
 *
 * ⚠️ THREE REASONS, ONE DIALOG:
 *  · `waking`   — the sandbox is archived or gone and is being started.
 *  · `starting` — it is up, but the app inside is not answering yet.
 *  · `appError` — it is answering with an error or an empty page: waiting will not fix
 *                 this one, the project needs a prompt.
 * The last two share an upstream error code (`SANDBOX_NOT_REACHABLE`) and need opposite
 * advice, which is why totalum-backend reports which of the two its probe saw.
 */
export type ServerBlockedReason = "waking" | "starting" | "appError";

export function useServerBlocked(): {
    reason: ServerBlockedReason | null;
    show: (reason: ServerBlockedReason) => void;
    dismiss: () => void;
} {
    const [reason, setReason] = React.useState<ServerBlockedReason | null>(null);

    React.useEffect(() => {
        const onBlocked = () => setReason("waking");
        window.addEventListener(SERVER_WAKE_BLOCKED_EVENT, onBlocked);
        return () => window.removeEventListener(SERVER_WAKE_BLOCKED_EVENT, onBlocked);
    }, []);

    return {
        reason,
        show: React.useCallback((next: ServerBlockedReason) => setReason(next), []),
        dismiss: React.useCallback(() => setReason(null), []),
    };
}

export function ServerBlockedDialog({
    reason,
    onDismiss,
    /** The workspace's own wake, so the dialog can carry its clock when it owns the wait. */
    wake,
}: {
    reason: ServerBlockedReason | null;
    onDismiss: () => void;
    wake?: ServerWake;
}) {
    const t = useT();
    const showStrip = reason === "waking" && !!wake?.waking;

    return (
        <Modal
            open={reason !== null}
            onOpenChange={open => {
                if (!open) onDismiss();
            }}
            size="sm"
            title={t(
                reason === "appError"
                    ? "workspace.serverWake.appErrorTitle"
                    : reason === "starting"
                      ? "workspace.serverWake.startingTitle"
                      : "workspace.serverWake.blockedTitle"
            )}
            description={t(
                reason === "appError"
                    ? "workspace.serverWake.appErrorBody"
                    : reason === "starting"
                      ? "workspace.serverWake.startingBody"
                      : "workspace.serverWake.blockedBody"
            )}
            footer={<Button onClick={onDismiss}>{t("workspace.serverWake.blockedCta")}</Button>}
            /* Nothing to show in the body unless this workspace owns the running wait —
               close the gap rather than leave dead space. */
            bodyClassName={showStrip ? undefined : "pb-0"}
        >
            {showStrip && wake && <ServerWakeNotice wake={wake} manualRetry={!wake.willRetry} />}
        </Modal>
    );
}
