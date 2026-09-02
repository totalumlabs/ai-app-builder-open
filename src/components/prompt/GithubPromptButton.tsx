"use client";

import * as React from "react";
import {
    ArrowDownToLineIcon,
    ExternalLinkIcon,
    FileKey2Icon,
    GithubIcon,
    LoaderIcon,
    SettingsIcon,
    TriangleAlertIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/i18n";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { GithubStatus } from "@/lib/vcaas-types";
import { cn } from "@/lib/utils";

/**
 * ⭐ GITHUB, BESIDE FIGMA, IN THE CHAT COMPOSER.
 *
 * ── WHY IT IS HERE AND NOT ONLY IN THE ACTIONS MENU ─────────────────────────
 *
 * GitHub sync was reachable from one place — a menu item that opened a connect
 * modal — and once connected there was nothing on screen that said so, and no way
 * to pull without going back through that modal. Both are things people do while
 * they are working, which is where the composer row already is: attach · speak ·
 * design · repository.
 *
 * ── THE BUTTON'S OWN COLOUR IS THE POINT OF THE WHOLE THING ─────────────────
 *
 * ⚠️ THREE STATES, NOT TWO, and the third is the one that matters. A fine-grained
 * GitHub token expires — `tokenValid: false` / `tokenExpired: true` — and until
 * something says so, the symptom is "my pulls stopped working" with no explanation
 * anywhere. Connected-and-healthy is green, connected-but-broken is amber and opens
 * straight onto reconnecting, and not-connected is the plain ghost icon every other
 * control in the row wears.
 *
 * ── IT FETCHES ITS OWN STATUS, ONCE, AND TELLS THE SHELL ────────────────────
 *
 * `GET …/github/status` is deliberately UNGATED upstream (see `GATED_ROUTES` — the
 * read-only status endpoints are excluded so a free account can render an honest
 * "not connected" instead of an error). Before this, `githubConnected` in the
 * workspace was only ever set by opening the modal, so the Code panel's connected
 * dot was wrong until you did. `onStatusChange` lifts the real answer up.
 *
 * ⚠️ `pull` AND `env` ARE PAID. They are gated in `GATED_ROUTES`, so a free account
 * gets `PLAN_REQUIRED` from the proxy. We do not re-implement that check here — the
 * server is the control — but a refusal is surfaced as a message rather than a
 * silent no-op.
 */


export interface GithubPromptButtonProps {
    projectId: string;
    /** Opens the full connect / manage modal. */
    onOpenModal: () => void;
    /** Lifts the real connection state so the rest of the workspace agrees with it. */
    onStatusChange?: (connected: boolean) => void;
    /**
     * ⭐ THE SHELL OWNS THE PULL — see the note on `handlePull` below. Optional so an
     * older embedding still renders; without it the pull item is simply not offered,
     * which is honest rather than half-working.
     */
    onPull?: () => void;
    /** `operationKind === "githubPull"` in the shell. The real state, not a local one. */
    pulling?: boolean;
    disabled?: boolean;
}

export function GithubPromptButton({
    projectId,
    onOpenModal,
    onStatusChange,
    onPull,
    pulling = false,
    disabled = false,
}: GithubPromptButtonProps) {
    const t = useT();

    const [open, setOpen] = React.useState(false);
    const [status, setStatus] = React.useState<GithubStatus | null>(null);

    const mounted = React.useRef(true);
    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const loadStatus = React.useCallback(async () => {
        const response = await vcaasApi.github.status(projectId);
        if (!mounted.current) return;

        if (response.ok && response.data) {
            setStatus(response.data);
            onStatusChange?.(!!response.data.connected);
        }
        // ⚠️ A FAILED STATUS READ LEAVES `null`, WHICH RENDERS AS "NOT CONNECTED"
        // WITHOUT A BADGE. Claiming "connected" on a failed read would be worse:
        // the popover would offer a pull against a repository we cannot confirm.
    }, [projectId, onStatusChange]);

    React.useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    // Re-read when the popover opens: the modal may have connected or disconnected
    // in between, and this is the cheapest moment to notice.
    React.useEffect(() => {
        if (open) void loadStatus();
    }, [open, loadStatus]);

    const connected = !!status?.connected;
    /** Connected, but the token will not work — see the header. */
    const needsAttention = connected && (status?.tokenValid === false || status?.tokenExpired === true);

    /**
     * ⭐⭐ THE PULL IS THE SHELL'S, NOT THIS BUTTON'S — AND THAT IS A FIX, NOT A TIDY-UP.
     *
     * ⚠️⚠️ THIS COMPONENT USED TO OWN THE WHOLE THING: the request, a `setInterval`
     * over `pull-status`, and its own toasts. Three things were wrong with that.
     *
     *   · **The poll died with the popover.** It closes itself the moment a pull
     *     starts, and an unmounted component's interval is cleared — so the outcome
     *     toast was a coin flip. `GithubModal` had exactly this bug and it is why
     *     `handleGithubPull` was moved to the shell in the first place; this button was
     *     simply missed.
     *   · **No operation record.** The shell's version calls `beginOperation`, which
     *     paints the banner over the preview, locks the composer and survives a reload.
     *     A pull started here was invisible to every one of those.
     *   · **⭐ It could not handle a sleeping server.** `SERVER_NOT_READY` came back as
     *     a red "pull failed" toast, when in fact VCaaS had just started the sandbox and
     *     the pull only needed re-firing. The shell's handler runs it through
     *     `useServerWake`, which shows the waking strip and retries on its own.
     *
     * So this now does one thing: close the popover and hand over. `pulling` comes
     * back down from the shell's operation slot, so the spinner is the real state.
     */
    function handlePull() {
        if (pulling || !onPull) return;
        setOpen(false);
        onPull();
    }

    /**
     * NOT CONNECTED ⇒ THE BUTTON IS JUST A SHORTCUT TO THE MODAL. A popover whose
     * only item is "connect" is a menu with one entry — one click is better than two.
     */
    if (!connected) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        disabled={disabled}
                        onClick={onOpenModal}
                        aria-label={t("workspace.github.title")}
                    >
                        <GithubIcon className="size-4" aria-hidden />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{t("workspace.github.connect")}</TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            /**
                             * ⚠️ `secondary`, NOT `ghost`, AND THAT IS NOT COSMETIC.
                             * `ghost` carries `hover:text-accent-foreground` and
                             * `dark:hover:bg-accent/50`; neither collides with a plain
                             * `hover:bg-*`/`text-*` under tailwind-merge, and the
                             * `dark:hover:` rule out-specifies ours in CSS — so a
                             * connected button would shed its tint the moment the cursor
                             * touched it, in the exact theme most of this app is used in.
                             * Every key `secondary` sets, we override.
                             */
                            variant="secondary"
                            size="icon"
                            /*
                              ⚠️ THE WHOLE BUTTON CARRIES THE STATE, NOT AN 8px DOT IN
                              ITS CORNER. A dot that size is invisible on a row of five
                              icons until you go looking for it, and "is this project
                              linked?" is a question people answer by glancing. A tint
                              plus a hairline ring reads at any distance and — like the
                              visual-editor toggle next door — costs no layout: it is
                              the same `size-8` icon button in every state, so
                              connecting or disconnecting cannot reflow the composer.
                            */
                            className={cn(
                                "relative size-8 shrink-0 ring-1 ring-inset",
                                needsAttention
                                    ? "bg-warning-subtle text-warning-subtle-foreground hover:bg-warning-subtle/70 ring-warning/40"
                                    : "bg-success-subtle text-success-subtle-foreground hover:bg-success-subtle/70 ring-success/40"
                            )}
                            disabled={disabled}
                            aria-label={t("workspace.github.title")}
                        >
                            {/* Pulling is the one thing that happens *to* the button
                                rather than being a state of it — so it animates. */}
                            <GithubIcon
                                className={cn("size-4", pulling && "animate-pulse")}
                                aria-hidden
                            />
                            <span className="sr-only">
                                {t(
                                    needsAttention
                                        ? "workspace.github.statusNeedsAttention"
                                        : "workspace.github.statusConnected"
                                )}
                            </span>
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    {status?.repositoryFullName || t("workspace.github.title")}
                </TooltipContent>
            </Tooltip>

            <PopoverContent align="start" className="w-72 p-1.5">
                {/* ── The repository, and a way out to it ───────────────────── */}
                <div className="px-1.5 pt-1 pb-2">
                    <p className="text-muted-foreground text-2xs font-medium tracking-wide uppercase">
                        {t("workspace.github.title")}
                    </p>
                    {status?.repositoryFullName ? (
                        <a
                            href={`https://github.com/${status.repositoryFullName}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary mt-0.5 flex items-center gap-1.5 font-mono text-xs break-all"
                        >
                            {status.repositoryFullName}
                            <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
                        </a>
                    ) : null}

                    {/*
                      The branches are read-only facts, but they are the answer to
                      "which branch did that pull touch?" — which nothing else in the
                      workspace says.
                    */}
                    {status?.developBranch || status?.productionBranch ? (
                        <p className="text-muted-foreground mt-1 font-mono text-2xs">
                            {[status?.developBranch, status?.productionBranch]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                    ) : null}
                </div>

                {needsAttention ? (
                    <p className="border-warning/40 bg-warning-subtle text-warning-subtle-foreground mb-1.5 flex items-start gap-1.5 rounded-md border p-2 text-xs">
                        <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                        <span>
                            {t(
                                status?.tokenExpired
                                    ? "workspace.github.tokenExpired"
                                    : "workspace.github.tokenInvalid"
                            )}
                        </span>
                    </p>
                ) : null}

                <div className="space-y-0.5">
                    {/*
                      ⚠️ PULL IS DISABLED WHILE THE TOKEN IS BROKEN. It would fail
                      upstream anyway; offering it and failing is worse than saying
                      "reconnect first", which is what the banner above already says.
                    */}
                    <MenuItem
                        icon={pulling ? LoaderIcon : ArrowDownToLineIcon}
                        spinning={pulling}
                        disabled={pulling || needsAttention}
                        onClick={() => void handlePull()}
                        label={t(pulling ? "workspace.github.pulling" : "workspace.github.pull")}
                    />

                    {/*
                      `.env` and the disconnect flow both live in the modal already —
                      the viewer, the confirmation and the dirty-guard are built there.
                      Duplicating them here would be two implementations of a
                      destructive action.
                    */}
                    <MenuItem
                        icon={FileKey2Icon}
                        onClick={() => {
                            setOpen(false);
                            onOpenModal();
                        }}
                        label={t("workspace.github.viewEnv")}
                    />
                    <MenuItem
                        icon={SettingsIcon}
                        onClick={() => {
                            setOpen(false);
                            onOpenModal();
                        }}
                        label={t("workspace.github.manage")}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}

function MenuItem({
    icon: Icon,
    label,
    onClick,
    disabled = false,
    spinning = false,
}: {
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    spinning?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none"
        >
            <Icon className={cn("size-3.5 shrink-0", spinning && "animate-spin")} aria-hidden />
            <span className="truncate">{label}</span>
        </button>
    );
}
