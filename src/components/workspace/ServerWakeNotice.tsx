"use client";

import * as React from "react";
import { LoaderIcon, TriangleAlertIcon } from "lucide-react";

import { useT } from "@/i18n";
import { formatDuration, PROGRESS_CEILING } from "@/lib/agent-progress";
import { cn } from "@/lib/utils";
import { WAKE_ESTIMATE_MS, type ServerWake } from "./use-server-wake";

/**
 * ═══ "YOUR SERVER IS STARTING" — INSIDE THE FEATURE THAT CAUSED IT ══════════
 *
 * ⚠️ IT IS A STRIP, NOT A DIALOG, AND THAT IS THE REQUIREMENT. It appears in the
 * visual editor's changes bar, in the code panel's toolbar, inside the GitHub modal,
 * under the preview — wherever the action was pressed — and it never covers the page.
 * Waking a server is a wait, not a modal state: the user can keep reading their code,
 * keep chatting to the agent, keep looking at the preview.
 *
 * ── WHAT IT IS ALLOWED TO SAY ───────────────────────────────────────────────
 *
 * ⚠️⚠️ NO API VOCABULARY, EVER. This replaced a corner toast carrying VCaaS's own
 * sentence verbatim:
 *
 *     "Server is already starting (status: Unarchiving). This may take 2 to 4 minutes
 *      depending on your project size. Poll GET /projects/landing-mockup and check
 *      agentServerStatus until it is "Active", then retry."
 *
 * That is a correct instruction to a PROGRAM. To the person who pressed Publish it is
 * four unknown words and a task they cannot perform. Everything here is written for
 * someone who has never heard of a sandbox: what is happening, how long it takes, and
 * whether they need to do anything.
 *
 * ── THE BAR ─────────────────────────────────────────────────────────────────
 *
 * ⚠️ IT STOPS SHORT OF THE END AND THEN SAYS SO. `WAKE_ESTIMATE_MS` is four minutes and
 * a cold unarchive can outrun it, so the fill is capped at `PROGRESS_CEILING` and the
 * label switches to "taking longer than usual" rather than sitting at 100 % while the
 * work continues. Same rule, same constant, as the agent run bar — a bar that reaches
 * the end while nothing has happened is what makes people reload.
 */
export function ServerWakeNotice({
    wake,
    action,
    className,
    compact,
    manualRetry,
}: {
    wake: ServerWake;
    /**
     * What we will do once the server is up, already translated — "publish", "apply
     * your changes". Omitted when the caller cannot retry for the user.
     */
    action?: string;
    className?: string;
    /** Denser variant for a toolbar or a bar that is already tight. */
    compact?: boolean;
    /**
     * ⚠️ THE ACTION WILL NOT BE REPLAYED — say "try again" instead of promising to do
     * it for them. See `serverWake.bodyRetry`.
     */
    manualRetry?: boolean;
}) {
    const t = useT();

    if (wake.failed) {
        return (
            <div
                role="status"
                className={cn(
                    "border-warning/40 bg-warning-subtle text-warning-subtle-foreground flex items-start gap-2 rounded-lg border p-2.5 text-xs leading-snug",
                    className
                )}
            >
                <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <p className="min-w-0 flex-1">{t("workspace.serverWake.failed")}</p>
            </div>
        );
    }

    if (!wake.waking) return null;

    const overrun = wake.elapsedMs >= WAKE_ESTIMATE_MS;
    const ratio = overrun
        ? PROGRESS_CEILING
        : Math.min(PROGRESS_CEILING, wake.elapsedMs / WAKE_ESTIMATE_MS);
    const percent = Math.round(ratio * 100);

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                "border-primary/30 bg-primary-subtle/40 text-foreground rounded-lg border border-dashed leading-snug",
                compact ? "p-2 text-2xs" : "p-2.5 text-xs",
                className
            )}
        >
            <div className="flex items-start gap-2">
                <LoaderIcon aria-hidden className="text-primary mt-0.5 size-3.5 shrink-0 animate-spin" />
                <div className="min-w-0 flex-1">
                    <p className="font-medium">{t("workspace.serverWake.title")}</p>
                    <p className="text-muted-foreground mt-0.5 text-pretty">
                        {manualRetry
                            ? t("workspace.serverWake.bodyRetry")
                            : action
                              ? t("workspace.serverWake.bodyWithAction", { action })
                              : t("workspace.serverWake.body")}
                    </p>
                </div>
                <span data-tabular className="text-muted-foreground shrink-0 tabular-nums">
                    {formatDuration(wake.elapsedMs)}
                </span>
            </div>

            {/*
              ⚠️ THE BAR IS AN ESTIMATE AND THE LABEL BESIDE IT SAYS WHICH. There is no
              progress signal to read — the server reports nothing between "starting" and
              "Active" — so this fills against a typical duration and is honest about it
              the moment that duration is passed.
            */}
            <div className="mt-2 flex items-center gap-2">
                <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    /* Past the estimate there is no meaningful value to announce. */
                    aria-valuenow={overrun ? undefined : percent}
                    aria-label={t("workspace.serverWake.title")}
                    className="bg-border/70 h-[3px] min-w-0 flex-1 overflow-hidden rounded-full"
                >
                    <div
                        className={cn(
                            "h-full rounded-full transition-[width] duration-1000 ease-linear",
                            overrun ? "bg-warning" : "bg-primary"
                        )}
                        style={{ width: `${Math.max(3, ratio * 100)}%` }}
                    />
                </div>
                <span
                    data-tabular
                    className={cn(
                        "shrink-0 text-2xs tabular-nums",
                        overrun ? "text-warning-subtle-foreground font-medium" : "text-muted-foreground"
                    )}
                >
                    {overrun ? t("workspace.serverWake.overrun") : `${percent}%`}
                </span>
            </div>
        </div>
    );
}
