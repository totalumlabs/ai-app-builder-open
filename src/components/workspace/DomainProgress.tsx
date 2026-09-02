"use client";

import * as React from "react";
import {
    ArrowDownIcon,
    CheckIcon,
    CircleAlertIcon,
    GlobeIcon,
    LoaderIcon,
    RefreshCwIcon,
} from "lucide-react";
import { StatusPill, type StatusTone } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/i18n";
import {
    domainWaitingMs,
    formatWaiting,
    getDomainProgress,
    isDomainAttentionNeeded,
    isDomainSlow,
    type DomainProgress as Progress,
    type DomainStepState,
} from "@/lib/domain-status";
import { cn } from "@/lib/utils";
import type { VcaasDomain } from "@/lib/vcaas-types";

/**
 * ═══ WHAT A DOMAIN IS DOING RIGHT NOW, IN THREE PLACES ══════════════════════
 *
 * DNS propagation is the longest wait in the product and the only one with no
 * progress attached to it — you add three records at a registrar and then nothing
 * visible happens for anywhere between four minutes and five hours. The previous
 * UI's entire answer was a "Pending DNS" pill, which says the same thing at minute
 * two and at hour four; people read the second one as a failure and removed a
 * domain that was about to verify.
 *
 * So the same derivation (`@/lib/domain-status`) renders at three sizes:
 *
 *   `DomainProgressPanel`    the domain modal — the full stepper, with the
 *                            auto-check countdown and a manual re-check.
 *   `DomainProgressCompact`  the publish dialog — a bar and one line, under the
 *                            domain row that is already there.
 *   `DomainPendingBadge`     beside Publish — the interruption, only while a
 *                            domain is attached and not yet live.
 *
 * ⚠️ NONE OF THEM HOLD STATE ABOUT THE DOMAIN. They render what the project says,
 * which is what makes all three vanish or turn green together the moment it is
 * removed or verifies — there is no local copy left to go stale.
 */

/** Progress-bar fill per tone. `StatusPill` covers the pills; the bar needs solids. */
const BAR_TONE: Record<StatusTone, string> = {
    neutral: "bg-muted-foreground",
    brand: "bg-primary",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    outline: "bg-foreground",
};

/** The in-flight marker: ring + glyph in the tone, on the card background. */
const MARKER_ACTIVE: Record<StatusTone, string> = {
    neutral: "border-muted-foreground/40 text-muted-foreground",
    brand: "border-primary/40 text-primary",
    info: "border-info/40 text-info",
    success: "border-success/40 text-success",
    warning: "border-warning/50 text-warning",
    danger: "border-destructive/40 text-destructive",
    outline: "border-border text-foreground",
};

/**
 * The step marker: a filled disc for what is done, a spinner for what is running.
 *
 * `compact` is the inline-rail size — small enough to sit between two words at
 * `text-2xs` without setting the line height.
 */
function StepMarker({
    state,
    tone,
    compact = false,
}: {
    state: DomainStepState;
    tone: StatusTone;
    compact?: boolean;
}) {
    const box = compact ? "size-3.5" : "size-5";
    const glyph = compact ? "size-2.5" : "size-3";

    if (state === "done") {
        return (
            <span
                aria-hidden
                className={cn(
                    "bg-success text-success-foreground grid shrink-0 place-items-center rounded-full",
                    box
                )}
            >
                <CheckIcon className={glyph} />
            </span>
        );
    }

    if (state === "failed") {
        return (
            <span
                aria-hidden
                className={cn(
                    "bg-destructive text-destructive-foreground grid shrink-0 place-items-center rounded-full",
                    box
                )}
            >
                <CircleAlertIcon className={compact ? "size-3" : "size-3.5"} />
            </span>
        );
    }

    if (state === "active") {
        // ⚠️ OUTLINED, NOT FILLED. A filled amber disc with a white glyph is the one
        // combination in this palette that fails contrast in light mode; the ring
        // carries the colour and the spinner carries the motion.
        return (
            <span
                aria-hidden
                className={cn(
                    "bg-card grid shrink-0 place-items-center rounded-full border-2",
                    box,
                    MARKER_ACTIVE[tone]
                )}
            >
                <LoaderIcon className={cn(glyph, "animate-spin motion-reduce:animate-none")} />
            </span>
        );
    }

    return (
        <span
            aria-hidden
            className={cn(
                "border-border bg-card grid shrink-0 place-items-center rounded-full border-2",
                box
            )}
        >
            <span className={cn("bg-muted-foreground/40 rounded-full", compact ? "size-1" : "size-1.5")} />
        </span>
    );
}

function ProgressBar({ progress, className }: { progress: Progress; className?: string }) {
    const t = useT();

    return (
        <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            aria-label={t("workspace.domain.progressLabel")}
            className={cn("bg-muted h-1.5 w-full overflow-hidden rounded-full", className)}
        >
            <div
                className={cn(
                    "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                    BAR_TONE[progress.tone]
                )}
                style={{ width: `${progress.percent}%` }}
            />
        </div>
    );
}

export interface DomainProgressPanelProps {
    domain: VcaasDomain;
    /** ms until the next automatic check, or null when nothing is scheduled. */
    nextCheckInMs: number | null;
    checking: boolean;
    onCheckNow: () => void;
    /** Ticking clock, passed in so the panel does not run a timer of its own. */
    now: number;
    /** Is the DNS records table rendered under this panel? Governs the "below". */
    recordsBelow: boolean;
    className?: string;
}

/**
 * THE STATUS STRIP — the domain modal, directly above the DNS records.
 *
 * ⚠️ IT IS FOUR LINES, AND THAT IS THE POINT. The first draft was a vertical
 * stepper: three markers, three titles, three descriptions, a countdown row, an
 * elapsed line and a boxed "taking longer" paragraph — over twenty lines of
 * chrome explaining a wait, sitting on top of the two DNS records that are the
 * only thing on this screen the user can act on. It pushed the records below the
 * fold, which is the opposite of what a screen about adding records should do.
 *
 * What survives is what changes or what you act on:
 *
 *   1. THE INSTRUCTION, first and in the warning colour while DNS is outstanding
 *      — "Add the DNS records below at your domain provider", with an arrow at
 *      the records themselves. Every other line here is status; this one is a job.
 *   2. The bar and the percent, on one line with it.
 *   3. The three steps as an inline rail — dot, word, dot, word — plus the
 *      countdown and "Check now" pushed to the end of the same row.
 *   4. One muted line: elapsed · expectation, replaced by the "taking longer"
 *      advice once we are past `DOMAIN_SLOW_AFTER_MS`. It never adds a fifth line.
 */
export function DomainProgressPanel({
    domain,
    nextCheckInMs,
    checking,
    onCheckNow,
    now,
    recordsBelow,
    className,
}: DomainProgressPanelProps) {
    const t = useT();
    const progress = getDomainProgress(domain);
    if (!progress) return null;

    const slow = isDomainSlow(domain, now);
    const seconds = nextCheckInMs === null ? null : Math.max(0, Math.ceil(nextCheckInMs / 1000));
    const waited = domainWaitingMs(domain, now);

    // The step the user is actually blocked on — the headline speaks for it.
    const current = progress.steps.find(s => s.state === "active" || s.state === "failed");
    /**
     * DNS outstanding is the ONLY state with something for the user to do.
     *
     * ⚠️ AND ONLY WHEN THE RECORDS ARE ACTUALLY ON SCREEN. "Add the records below"
     * with no table below it sends someone scrolling for something that isn't
     * there — VCaaS omits `dnsRecordsToAdd` in some states, so this is a real case,
     * not a defensive one.
     */
    const needsRecords = current?.id === "dns" && current.state === "active" && recordsBelow;

    return (
        <section
            className={cn(
                "rounded-lg border p-2.5",
                // The whole strip turns amber while it is waiting on the user, so
                // the instruction is legible before a single word is read.
                needsRecords
                    ? "border-warning/40 bg-warning-subtle"
                    : "border-border bg-surface-sunken",
                className
            )}
            aria-live="polite"
        >
            {/* 1 + 2 — the instruction, the bar, the percent. */}
            <div className="flex items-center gap-2">
                {needsRecords ? (
                    <ArrowDownIcon
                        aria-hidden
                        className="text-warning size-3.5 shrink-0 animate-bounce motion-reduce:animate-none"
                    />
                ) : (
                    <StepMarker state={current?.state ?? "done"} tone={progress.tone} />
                )}

                <p
                    className={cn(
                        "min-w-0 flex-1 text-xs leading-tight font-medium",
                        needsRecords ? "text-warning-subtle-foreground" : "text-foreground"
                    )}
                >
                    {needsRecords
                        ? t("workspace.domain.actionAddRecords")
                        : current
                          ? t(current.detailKey)
                          : t(progress.helpKey)}
                </p>

                <span className="text-muted-foreground text-2xs shrink-0 font-medium tabular-nums">
                    {progress.percent}%
                </span>
            </div>

            <ProgressBar progress={progress} className="mt-2 h-1" />

            {/* 3 — the rail, the countdown and the manual check, all on one row. */}
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {progress.steps.map(s => (
                    <span key={s.id} className="text-2xs flex items-center gap-1">
                        <StepMarker state={s.state} tone={progress.tone} compact />
                        <span
                            className={cn(
                                s.state === "waiting" ? "text-muted-foreground" : "font-medium"
                            )}
                        >
                            {t(s.titleKey)}
                        </span>
                    </span>
                ))}

                {progress.isSettling && (
                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                        <span className="text-muted-foreground text-2xs flex items-center gap-1 tabular-nums">
                            <RefreshCwIcon
                                aria-hidden
                                className={cn(
                                    "size-3",
                                    checking && "animate-spin motion-reduce:animate-none"
                                )}
                            />
                            {checking
                                ? t("workspace.domain.checking")
                                : seconds === null
                                  ? t("workspace.domain.checksAutomatically")
                                  : t("workspace.domain.nextCheckIn", { seconds })}
                        </span>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-2xs h-6 px-1.5"
                            onClick={onCheckNow}
                            disabled={checking}
                        >
                            {t("workspace.domain.checkNow")}
                        </Button>
                    </span>
                )}
            </div>

            {/*
              4 — ONE line, never two.

              ⚠️ THE "TAKING LONGER" ADVICE IS NOT AN ERROR AND GETS NO BOX. Two
              hours in, the odds shift from "DNS is slow" to "a record is wrong", so
              the sentence changes — but the domain may still verify, and a boxed
              red warning over a wait that is behaving normally is how you get
              someone to delete a domain that was about to work.
            */}
            {progress.isSettling && (
                <p className="text-muted-foreground text-2xs mt-1.5 leading-relaxed">
                    {waited !== null && (
                        <span className="text-foreground font-medium tabular-nums">
                            {t("workspace.domain.waitingFor", { duration: formatWaiting(waited) })}
                            {" · "}
                        </span>
                    )}
                    {slow ? t("workspace.domain.slowShort") : t("workspace.domain.expectationShort")}
                </p>
            )}
        </section>
    );
}

/**
 * THE COMPACT BAR — the publish dialog. One line and a bar under the domain row,
 * because the question there is "is my address ready?", not "which record failed?".
 */
export function DomainProgressCompact({
    domain,
    className,
}: {
    domain: VcaasDomain;
    className?: string;
}) {
    const t = useT();
    const progress = getDomainProgress(domain);
    if (!progress || progress.isLive) return null;

    const activeIndex = progress.steps.findIndex(s => s.state === "active" || s.state === "failed");
    const current = activeIndex >= 0 ? progress.steps[activeIndex] : null;

    /*
      ⚠️ "BELOW" IS TRUE IN THE DOMAIN MODAL AND FALSE HERE. The DNS step's detail
      copy points at the records table it sits directly above; in the publish dialog
      that table is behind a button, so this state gets its own sentence rather than
      sending someone hunting for a table that is not on screen.
    */
    const line =
        current?.id === "dns" && current.state === "active"
            ? t("workspace.domain.actionAddRecordsElsewhere")
            : current
              ? t(current.detailKey)
              : t(progress.helpKey);

    return (
        <div className={cn("space-y-1.5", className)}>
            <ProgressBar progress={progress} />

            <div className="flex items-start justify-between gap-2">
                <p className="text-muted-foreground min-w-0 flex-1 text-xs leading-relaxed">
                    {current && (
                        <span className="text-foreground font-medium">
                            {t("workspace.domain.stepOf", {
                                current: activeIndex + 1,
                                total: progress.steps.length,
                            })}{" "}
                        </span>
                    )}
                    {line}
                </p>
                <span className="text-muted-foreground text-2xs shrink-0 font-medium tabular-nums">
                    {progress.percent}%
                </span>
            </div>
        </div>
    );
}

/**
 * THE BADGE BESIDE PUBLISH.
 *
 * Someone who has attached a domain and not finished the DNS has an unfinished
 * job with no home: the records live behind two clicks, and nothing on the screen
 * remembers for them. This is the reminder, and it opens exactly where the work is.
 *
 * ⚠️ IT RENDERS NOTHING WHEN THERE IS NO DOMAIN OR THE DOMAIN IS LIVE. Removing
 * the domain removes the badge with it — the condition is read from the project
 * on every render, so there is no dismissal state to get stuck.
 */
export function DomainPendingBadge({
    domain,
    onOpen,
    className,
}: {
    domain: VcaasDomain | null | undefined;
    onOpen: () => void;
    className?: string;
}) {
    const t = useT();

    if (!isDomainAttentionNeeded(domain) || !domain) return null;
    const progress = getDomainProgress(domain);
    if (!progress) return null;

    const label = progress.isFailed
        ? t("workspace.deploy.domainBadgeFailed")
        : t("workspace.deploy.domainBadgePending");

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    data-phase="10-paid-domain"
                    onClick={onOpen}
                    aria-label={t("workspace.deploy.domainBadgeAria", {
                        hostname: domain.hostname,
                        status: label,
                    })}
                    className={cn(
                        "focus-visible:ring-ring shrink-0 rounded-full transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:outline-none",
                        className
                    )}
                >
                    <StatusPill
                        tone={progress.isFailed ? "danger" : "warning"}
                        dot
                        pulse={progress.isSettling}
                        className="h-7 cursor-pointer gap-1.5 px-2"
                    >
                        <GlobeIcon aria-hidden className="size-3" />
                        {/* At 375px the header is already full — the dot and the
                            tooltip carry it, and the label returns at `sm`. */}
                        <span className="hidden sm:inline">{label}</span>
                    </StatusPill>
                </button>
            </TooltipTrigger>
            <TooltipContent>
                <span className="block font-medium">{domain.hostname}</span>
                <span className="block">{t(progress.helpKey)}</span>
            </TooltipContent>
        </Tooltip>
    );
}
