"use client";

import * as React from "react";
import {
    CheckCircle2Icon,
    ExternalLinkIcon,
    EyeIcon,
    EyeOffIcon,
    FigmaIcon,
    LoaderIcon,
    ShieldAlertIcon,
    TriangleAlertIcon,
} from "lucide-react";
import { ConfirmDialog, ErrorState, Modal, StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { FigmaAccount, FigmaStatus } from "@/lib/vcaas-types";
import { useDirtyGuard } from "./use-dirty-guard";

/**
 * ═══ FIGMA CONNECT (Feature H2) ═════════════════════════════════════════════
 *
 * Link a Figma account so the agent can read designs and build from them.
 *
 * ── WHY A TOKEN AND NOT "SIGN IN WITH FIGMA" ────────────────────────────────
 *
 * Figma's official remote MCP server needs an interactive OAuth browser sign-in
 * and explicitly refuses personal access tokens. Our agent runs on a headless
 * sandbox with no browser and nobody sitting in front of it, so that flow cannot
 * complete. The full research, with links, is in `figma.service.ts` in
 * totalum-backend and in PROGRESS.md — read it before "improving" this to OAuth.
 *
 * ── THE TOKEN IS A LIVE CREDENTIAL, AND IS TREATED LIKE ONE ─────────────────
 *
 * Same rules as the GitHub modal, for the same reasons:
 *   · `type="password"` by default, so a screen share does not leak it;
 *   · cleared from component state on BOTH success and failure;
 *   · never logged, never put in a toast, never echoed back by the server;
 *   · `autoComplete="off"` keeps it out of the browser's password manager;
 *   · the modal names the MINIMUM scopes, because Figma's token UI defaults to
 *     offering far more than we need.
 *
 * ⚠️ NOT A PAID FEATURE. Unlike GitHub and custom domains this is NOT wrapped in
 * `<PaidFeature>` and is not metered by the H1 quotas: the user brings their own
 * Figma seat, token and rate limit, and we provision nothing. Do not "align" it
 * with the GitHub modal by adding a gate.
 *
 * ⚠️ NEVER COMBINE `useDirtyGuard` WITH `dismissible` — see the note in
 * `use-dirty-guard.tsx`. `dismissible={false}` stops Radix ever firing
 * `onOpenChange`, which is exactly what the guard works by intercepting.
 *
 * ── ⭐ PENDING MODE: CONNECTING BEFORE THE PROJECT EXISTS ───────────────────
 *
 * The dashboard offers Figma in the hero composer, where the project has not been
 * created yet — the same submit that carries the design link is what creates it.
 * A token cannot be STORED against a project that does not exist, so with no
 * `projectId` this modal does the only honest half it can:
 *
 *   · `POST /vcaas/figma/validate` — Figma itself says whether the token is good.
 *     Nothing is stored, on either service.
 *   · `onPendingToken(token, account)` — the caller holds it in memory and calls
 *     the real per-project connect the instant the project exists.
 *
 * ⚠️ IT IS DELIBERATELY NOT CALLED "CONNECTED" IN THIS MODE. The copy says the
 * token is accepted and *will be* connected on create, because claiming a
 * connection to a project that does not exist would be a lie the user only finds
 * out about when their first prompt cannot read the design.
 */

/** The scopes the agent actually needs. Shown to the user, verbatim. */
const REQUIRED_SCOPES = ["current_user:read", "file_content:read"] as const;

const FIGMA_TOKEN_SETTINGS_URL = "https://www.figma.com/settings";

export interface FigmaModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * ⚠️ EMPTY ON THE DASHBOARD, AND THAT IS THE SECOND MODE. See `PENDING MODE`
     * in the header note: with no project there is nothing to store a token on yet,
     * so the modal validates it and hands it back instead.
     */
    projectId?: string;
    /** Lets the workspace header show the connected dot. */
    onStatusChange: (connected: boolean) => void;
    /**
     * PENDING MODE ONLY. Called with a token that Figma itself has just accepted,
     * for the caller to apply once the project exists.
     *
     * ⚠️ THE CALLER IS TAKING CUSTODY OF A LIVE CREDENTIAL. It must keep it in
     * memory only, use it once, and drop it — never a store, never a cookie, never
     * a log. `ProjectsDashboard` is the only caller and documents exactly that.
     */
    onPendingToken?: (token: string, account?: FigmaAccount) => void;
}

export function FigmaModal({
    open,
    onOpenChange,
    projectId,
    onStatusChange,
    onPendingToken,
}: FigmaModalProps) {
    const t = useT();

    /** No project to store against ⇒ validate-and-hand-back. See the header. */
    const pendingMode = !projectId;

    const [status, setStatus] = React.useState<FigmaStatus | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [loadFailed, setLoadFailed] = React.useState(false);
    const [connecting, setConnecting] = React.useState(false);
    const [token, setToken] = React.useState("");
    const [showToken, setShowToken] = React.useState(false);
    const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);

    // ⚠️ The signature is `(isDirty, close)`, and `close` runs only once the guard
    // has allowed it — so clearing the token here is guaranteed not to happen while
    // the "discard your changes?" prompt is still open.
    const guard = useDirtyGuard(token.trim().length > 0, () => {
        // Never leave a live credential in state behind a closed modal.
        setToken("");
        setShowToken(false);
        onOpenChange(false);
    });

    const loadStatus = React.useCallback(
        async (verify: boolean) => {
            // ⚠️ Nothing to ask about in pending mode — there is no project. Asking
            // anyway would send `/projects//figma/status` and 404.
            if (!projectId) return;

            setLoading(true);
            setLoadFailed(false);

            // ⚠️ `verify` re-checks the token against Figma. Asked for when the modal
            // OPENS so a revoked token is caught, never on a repeat — it is a live
            // call against the user's Figma rate limit.
            const response = await vcaasApi.figma.status(projectId, verify);
            setLoading(false);

            if (response.ok && response.data) {
                setStatus(response.data);
                onStatusChange(!!response.data.connected);
            } else {
                setLoadFailed(true);
            }
        },
        [projectId, onStatusChange]
    );

    React.useEffect(() => {
        if (!open) return;
        void loadStatus(true);
    }, [open, loadStatus]);

    async function handleConnect(event: React.FormEvent) {
        event.preventDefault();
        const value = token.trim();
        if (!value || connecting) return;

        setConnecting(true);
        /**
         * ⚠️ TWO ENDPOINTS, ONE FORM. With a project the token is validated AND
         * stored upstream; without one it is only validated, and the caller stores
         * nothing — it holds the value until the project exists.
         */
        const response = pendingMode
            ? await vcaasApi.figma.validate({ token: value })
            : await vcaasApi.figma.connect(projectId!, { token: value });
        setConnecting(false);

        // Clear it whatever happened — it has been sent and there is no reason to
        // keep a live credential in component state.
        setToken("");
        setShowToken(false);

        if (response.ok) {
            if (pendingMode) {
                /**
                 * ⚠️ THE TOKEN GOES TO THE CALLER AND NOWHERE ELSE, and this is the
                 * only line in the app that hands one out. `value` is a local const
                 * — component state was already cleared above — so nothing here
                 * keeps it after this call returns.
                 */
                onPendingToken?.(value, (response.data as { account?: FigmaAccount })?.account);
                onStatusChange(true);
                toast.success(t("workspace.figma.validated"));
                onOpenChange(false);
                return;
            }

            toast.success(t("workspace.figma.connected"));
            await loadStatus(false);
        } else {
            /**
             * ⚠️ `response.error` IS THE SPECIFIC REASON, and showing it is the whole
             * point of validating upstream: "that token has expired", "missing the
             * scopes Totalum needs". A generic "failed to connect" would send people
             * to regenerate a token that was fine. It never contains the token.
             */
            toast.error(t("workspace.figma.connectFailed"), {
                description: response.error || undefined,
            });
        }
    }

    async function handleDisconnect() {
        const response = await vcaasApi.figma.disconnect(projectId);

        if (!response.ok) {
            toast.error(t("workspace.figma.disconnectFailed"), {
                description: response.error || undefined,
            });
            throw new Error(response.error || "disconnect failed");
        }

        toast.success(t("workspace.figma.disconnected"));
        setStatus({ connected: false });
        onStatusChange(false);
    }

    const connected = !!status?.connected;
    const account = status?.account;
    const tokenBroken = connected && status?.tokenValid === false;

    return (
        <>
            <Modal
                open={open}
                onOpenChange={guard.onOpenChange}
                size="lg"
                title={t("workspace.figma.title")}
                description={t("workspace.figma.description")}
                headerAside={
                    connected ? (
                        <StatusPill tone={tokenBroken ? "warning" : "success"} dot>
                            {t(tokenBroken ? "workspace.figma.statusNeedsAttention" : "workspace.figma.statusConnected")}
                        </StatusPill>
                    ) : undefined
                }
            >
                <div className="space-y-4">
                    {/* ── Loading ─────────────────────────────────────────── */}
                    {loading && !status && (
                        <div className="grid place-items-center py-8">
                            <LoaderIcon className="text-muted-foreground size-5 animate-spin" aria-hidden />
                        </div>
                    )}

                    {/* ── Error, with retry ───────────────────────────────── */}
                    {!loading && loadFailed && !status && (
                        <ErrorState
                            variant="panel"
                            description={t("workspace.figma.loadFailed")}
                            onRetry={() => void loadStatus(true)}
                        />
                    )}

                    {!loading && !loadFailed && connected ? (
                        // ── Connected ────────────────────────────────────────
                        <div className="space-y-3">
                            <div className="border-border rounded-lg border p-3">
                                <div className="flex items-center gap-3">
                                    {/* Figma serves avatars from its own CDN; a plain
                                        <img> avoids adding a remote host to next.config. */}
                                    {account?.imgUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={account.imgUrl}
                                            alt=""
                                            className="size-9 shrink-0 rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
                                            <FigmaIcon className="size-4" aria-hidden />
                                        </span>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">
                                            {account?.handle || t("workspace.figma.unknownAccount")}
                                        </p>
                                        {account?.email && (
                                            <p className="text-muted-foreground truncate text-xs">
                                                {account.email}
                                            </p>
                                        )}
                                    </div>

                                    {!tokenBroken && (
                                        <CheckCircle2Icon className="text-success size-4 shrink-0" aria-hidden />
                                    )}
                                </div>
                            </div>

                            {/*
                              ⚠️ A REVOKED OR EXPIRED TOKEN IS SURFACED, NOT SWALLOWED.
                              The connection is not deleted server-side either — the
                              user just pastes a new token over it.
                            */}
                            {tokenBroken && (
                                <p className="border-warning/40 bg-warning-subtle text-warning-subtle-foreground flex gap-2 rounded-lg border p-2.5 text-xs">
                                    <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                                    <span>{t("workspace.figma.tokenBroken")}</span>
                                </p>
                            )}

                            <WhatItEnables t={t} />

                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => setConfirmDisconnect(true)}>
                                    {t("workspace.figma.disconnect")}
                                </Button>
                                {/* ⚠️ Only when the token still WORKS. When it does not, the
                                    paste-a-new-one form is rendered directly below, and a
                                    second route to Figma's settings next to it just competes
                                    with the thing we want them to do. */}
                                {!tokenBroken && (
                                    <Button variant="ghost" size="sm" asChild>
                                        <a href={FIGMA_TOKEN_SETTINGS_URL} target="_blank" rel="noopener noreferrer">
                                            {t("workspace.figma.replaceToken")}
                                            <ExternalLinkIcon className="size-3.5" aria-hidden />
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {/*
                      ── The connect form ──────────────────────────────────
                      ⚠️ ALSO SHOWN WHEN A CONNECTED TOKEN HAS STOPPED WORKING.
                      Caught by looking at it: the warning above says "paste a new
                      one" and the only controls were "Disconnect" and a link that
                      opened Figma in another tab. Telling someone to do something
                      and not giving them the box to do it in is the bug.
                      `WhatItEnables` is skipped in that case — the connected block
                      above is already showing it.
                    */}
                    {!loading && !loadFailed && (!connected || tokenBroken) && (
                        <form onSubmit={handleConnect} className="space-y-4">
                            {!connected && <WhatItEnables t={t} />}

                            <div className="space-y-1.5">
                                <Label htmlFor="figma-token" className="text-xs">
                                    {t("workspace.figma.tokenLabel")}
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="figma-token"
                                        type={showToken ? "text" : "password"}
                                        value={token}
                                        onChange={event => setToken(event.target.value)}
                                        placeholder="figd_…"
                                        // Keep a live credential out of the password manager.
                                        autoComplete="off"
                                        spellCheck={false}
                                        className="h-8 pr-8 font-mono text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowToken(v => !v)}
                                        aria-label={t(showToken ? "workspace.secrets.hide" : "workspace.secrets.show")}
                                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                        {showToken ? (
                                            <EyeOffIcon className="size-3.5" aria-hidden />
                                        ) : (
                                            <EyeIcon className="size-3.5" aria-hidden />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* ── Where to get one, and with which scopes ──── */}
                            <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-3">
                                <p className="text-xs font-medium">{t("workspace.figma.howToTitle")}</p>
                                <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
                                    <li>{t("workspace.figma.howToStep1")}</li>
                                    <li>{t("workspace.figma.howToStep2")}</li>
                                    <li>{t("workspace.figma.howToStep3")}</li>
                                </ol>
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <span className="text-muted-foreground text-xs">
                                        {t("workspace.figma.scopesLabel")}
                                    </span>
                                    {REQUIRED_SCOPES.map(scope => (
                                        <code
                                            key={scope}
                                            className="bg-background border-border rounded border px-1.5 py-0.5 font-mono text-[11px]"
                                        >
                                            {scope}
                                        </code>
                                    ))}
                                </div>
                                <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                                    <a href={FIGMA_TOKEN_SETTINGS_URL} target="_blank" rel="noopener noreferrer">
                                        {t("workspace.figma.openFigmaSettings")}
                                        <ExternalLinkIcon className="size-3.5" aria-hidden />
                                    </a>
                                </Button>
                            </div>

                            {/* ⚠️ The security note is not decoration — it is why the
                                user should feel safe pasting a credential here. */}
                            <p className="text-muted-foreground flex gap-2 text-xs">
                                <ShieldAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                                <span>{t("workspace.figma.securityNote")}</span>
                            </p>

                            <Button type="submit" disabled={!token.trim() || connecting} className="w-full">
                                {connecting && <LoaderIcon className="size-4 animate-spin" aria-hidden />}
                                {t(
                                    connecting
                                        ? "workspace.figma.connecting"
                                        : tokenBroken
                                          ? "workspace.figma.reconnect"
                                          : "workspace.figma.connect"
                                )}
                            </Button>
                        </form>
                    )}
                </div>
            </Modal>

            <ConfirmDialog
                open={confirmDisconnect}
                onOpenChange={setConfirmDisconnect}
                tone="danger"
                title={t("workspace.figma.confirmDisconnectTitle")}
                description={t("workspace.figma.confirmDisconnectBody")}
                confirmLabel={t("workspace.figma.disconnect")}
                onConfirm={handleDisconnect}
            />

            {guard.confirmDialog}
        </>
    );
}

/**
 * What connecting actually buys you.
 *
 * Shown in BOTH states on purpose: before connecting it is the reason to bother,
 * and after connecting it is how you learn what to ask the agent for. A connected
 * integration nobody knows how to use is the same as no integration.
 */
function WhatItEnables({ t }: { t: ReturnType<typeof useT> }) {
    return (
        <div className="border-border bg-muted/40 space-y-1.5 rounded-lg border p-3">
            <p className="text-xs font-medium">{t("workspace.figma.enablesTitle")}</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
                <li>· {t("workspace.figma.enables1")}</li>
                <li>· {t("workspace.figma.enables2")}</li>
                <li>· {t("workspace.figma.enables3")}</li>
            </ul>
            <p className="text-muted-foreground pt-0.5 text-[11px] italic">
                {t("workspace.figma.enablesTip")}
            </p>
        </div>
    );
}
