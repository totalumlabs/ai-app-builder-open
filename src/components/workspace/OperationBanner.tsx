"use client";

import * as React from "react";
import { DownloadIcon, HammerIcon, HistoryIcon, RocketIcon, ServerIcon, UploadIcon } from "lucide-react";
import { useT } from "@/i18n";
import { formatDuration } from "@/lib/agent-progress";
import {
    OPERATION_COPY,
    OPERATION_PROFILES,
    operationProgress,
    type ProjectOperationKind,
} from "@/lib/project-operation";
import { cn } from "@/lib/utils";

/**
 * ═══ "YOUR PROJECT IS BUSY, AND HERE IS HOW BUSY" ═══════════════════════════
 *
 * The band directly above the preview while a publish, a rebuild, a GitHub pull or a
 * server restart is in flight. One component for all four — the kind chooses the icon
 * and the words, nothing else changes — because they are the same promise to the user:
 * something is happening, it takes this long, it has been going this long, and the
 * workspace will come back on its own.
 *
 * ── WHY IT IS HERE AND NOT A TOAST ──────────────────────────────────────────
 *
 * ⚠️ A TOAST IS THE WRONG CONTAINER FOR THREE MINUTES. It leaves after four seconds,
 * and the state it described lasts fifty times longer — so the only thing on screen
 * afterwards was a locked chat with no explanation, which reads as a broken product.
 * Toasts still announce the START and the OUTCOME, which are moments; this band is
 * the state in between.
 *
 * ⚠️ IT DOES NOT SCROLL AWAY. The workspace shell never scrolls (the panels own their
 * scrollers), so a `shrink-0` sibling above the panel is pinned by construction —
 * no `position: fixed`, no z-index war with the modals, no gap when the panel is a
 * full-bleed iframe.
 *
 * ⚠️ IT SPANS THE PANEL, NOT THE WINDOW. It belongs to the project surface, which is
 * what is affected; the chat beside it has its own, LOCAL, explanation inside the
 * composer. On a phone, where the chat replaces the panel, it sits above both.
 *
 * ── WHAT IT IS ALLOWED TO CLAIM ─────────────────────────────────────────────
 *
 * ⚠️ THE PERCENTAGE IS AN ESTIMATE AND SAYS SO. None of these four endpoints reports
 * progress — they report "started" and, minutes later, an outcome — so the bar fills
 * against the top of the quoted range via `operationProgress`, holds at 97 % and
 * switches to "longer than usual" rather than sitting full. The ELAPSED time beside
 * it is the one hard number, and it is the one people actually read.
 *
 * ⚠️ NO CANCEL BUTTON, BECAUSE THERE IS NO CANCEL. The work is a background task on
 * the sandbox with no abort endpoint; a button that only hid the banner would be a
 * lie that unlocks a chat whose prompts would then race the build.
 */

/**
 * ⚠️ EXHAUSTIVE BY TYPE, ON PURPOSE. `Record<ProjectOperationKind, …>` is what turned
 * "somebody added a fifth operation and its banner renders with no icon" into a
 * compile error — which is exactly what happened when version restore was added.
 */
const ICONS: Record<ProjectOperationKind, typeof RocketIcon> = {
    publish: RocketIcon,
    rebuild: HammerIcon,
    githubPull: DownloadIcon,
    restartServer: ServerIcon,
    /* The same glyph the versions modal and its rows use — a restore is the one
       operation that takes the project BACKWARDS, and it should look like it. */
    restoreVersion: HistoryIcon,
    /* An import brings a whole project IN — the same glyph the import dialog uses.
       ⚠️ This banner is mostly invisible for an import: `ImportOverlay` covers the
       screen while one runs. It still has to exist, because the overlay closes the
       moment the operation settles and the banner is what the workspace shows for
       the last frames of a `stalled` one. */
    import: UploadIcon,
};

export function OperationBanner({
    kind,
    elapsedMs,
    className,
}: {
    kind: ProjectOperationKind;
    elapsedMs: number;
    className?: string;
}) {
    const t = useT();
    const copy = OPERATION_COPY[kind];
    const profile = OPERATION_PROFILES[kind];
    const { ratio, percent, overrun } = operationProgress(kind, elapsedMs);
    const Icon = ICONS[kind];

    return (
        <div
            /**
             * ⚠️ `role="status"` + `aria-live="polite"`, ON THE WRAPPER. The clock
             * inside changes every second and is deliberately NOT in a live region of
             * its own — announcing "1:03… 1:04…" for four minutes is not an
             * accessibility feature. The title changing is what deserves an
             * announcement, and it changes twice: when it appears and when it goes.
             */
            role="status"
            aria-live="polite"
            data-operation={kind}
            className={cn(
                "relative shrink-0 border-b",
                overrun
                    ? "border-warning/30 bg-warning-subtle"
                    : "border-primary/25 bg-primary-subtle",
                className
            )}
        >
            <div className="flex items-center gap-2.5 px-3 py-2 sm:gap-3 sm:px-4">
                {/*
                  ⚠️ NOT A SPINNER. For most of these minutes the sandbox is
                  installing quietly and a spinner promises a thing that is visibly
                  turning; `animate-pulse-soft` reads as "alive" without claiming
                  motion. The utility is `motion-safe` internally, so reduced-motion
                  users get a still glyph rather than nothing at all.
                */}
                <span
                    aria-hidden
                    className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg ring-1",
                        overrun
                            ? "bg-warning/15 text-warning-subtle-foreground ring-warning/25"
                            : "bg-card text-primary ring-primary/20"
                    )}
                >
                    <Icon className="size-3.5 motion-safe:animate-pulse-soft" />
                </span>

                <div className="min-w-0 flex-1">
                    <p
                        className={cn(
                            "truncate text-xs font-semibold",
                            overrun ? "text-warning-subtle-foreground" : "text-foreground"
                        )}
                    >
                        {t(copy.title)}
                    </p>
                    {/*
                      ⚠️ THE SECOND LINE IS HIDDEN BELOW `sm`, AND ONLY THE SECOND
                      LINE. At 375px the banner sits above a phone-width preview and
                      two lines of prose push the frame down by a third of a screen;
                      the title and the clock — what is happening and how long it has
                      been — survive at every width. The full sentence is also in the
                      toast that announced the start, so nothing is only here.
                    */}
                    <p className="text-muted-foreground mt-0.5 hidden text-xs leading-snug text-pretty sm:block">
                        {t(copy.description, {
                            min: profile.minMinutes,
                            max: profile.maxMinutes,
                        })}
                    </p>
                </div>

                <div className="shrink-0 text-right">
                    <p data-tabular className="text-xs font-medium tabular-nums">
                        {formatDuration(elapsedMs)}
                    </p>
                    <p
                        data-tabular
                        className={cn(
                            "text-2xs tabular-nums",
                            overrun
                                ? "text-warning-subtle-foreground font-medium"
                                : "text-muted-foreground"
                        )}
                    >
                        {overrun
                            ? t("workspace.operation.overrun")
                            : t("workspace.operation.estimate", { minutes: profile.maxMinutes })}
                    </p>
                </div>
            </div>

            {/*
              ── THE BAR ────────────────────────────────────────────────────────
              ⭐ IT IS THE BOTTOM EDGE OF THE BANNER, full width, 3px. A boxed bar
              inside the padding would be a second object in a band that is already
              a status object; sitting ON the border it reads as the band filling up,
              and it doubles as the divider between the banner and the preview.

              ⚠️ `aria-valuenow` IS DROPPED PAST THE ESTIMATE — the same rule the
              chat's run bar follows. There is no meaningful value to announce once
              the estimate is gone, and repeating "97 per cent" for the rest of the
              operation is worse than saying nothing.
            */}
            <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={overrun ? undefined : percent}
                aria-label={t("workspace.operation.progressLabel")}
                className="bg-border/60 absolute inset-x-0 bottom-0 h-[3px] overflow-hidden"
            >
                <div
                    className={cn(
                        "relative h-full rounded-r-full transition-[width] duration-1000 ease-linear",
                        overrun ? "bg-warning" : "bg-primary"
                    )}
                    style={{ width: `${Math.max(2, ratio * 100)}%` }}
                >
                    {/* The head breathes so a bar gaining 0.4 % a second still reads
                        as moving. `tp-run-shine` is the chat bar's, unchanged. */}
                    <span aria-hidden className="tp-run-shine" />
                </div>
            </div>
        </div>
    );
}
