"use client";

import * as React from "react";
import { AlertTriangleIcon, CheckIcon, LoaderIcon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { ConfirmDialog } from "@/components/primitives";
import { aspectsOf, describeChange, roleOf, type ChangeAspect, type ElementRole, type VisualChange } from "@/lib/visual-edit";
import { cn } from "@/lib/utils";

import type { ApplyOutcome, ApplyPhase } from "./use-visual-editor";

/**
 * ═══ THE UNSAVED-CHANGES BAR (Feature F12) ══════════════════════════════════
 *
 * Persistent while anything is pending: a count, every change with its own undo,
 * discard-all, and Apply.
 *
 * ⚠️ IT IS ALSO THE REBUILD LOADER AND THE FAILURE REPORT, deliberately. The user's
 * attention is already here when they press Apply; sending the outcome somewhere
 * else (a toast that vanishes, a panel they must open) is how "3 of 4 changes were
 * applied" goes unnoticed. Everything about this batch happens in one place.
 */

const KIND_LABEL: Record<VisualChange["kind"], TranslationKey> = {
    text: "workspace.visualEditor.kindText",
    class: "workspace.visualEditor.kindStyle",
    src: "workspace.visualEditor.kindMedia",
};

const UNMAPPED_REASON: Record<string, TranslationKey> = {
    "not-found": "workspace.visualEditor.unmappedNotFound",
    ambiguous: "workspace.visualEditor.unmappedAmbiguous",
    "low-confidence": "workspace.visualEditor.unmappedLowConfidence",
    /**
     * ⭐ Two changes landed on the same piece of source. The earlier one wins and
     * this one is reported — where before, the conflict was discovered silently
     * during the write and cost the user the WHOLE batch with `UNSAFE_WRITE`.
     * The copy says what to do about it, because "overlapping edit" means nothing
     * to someone who was clicking on a heading.
     */
    overlapping: "workspace.visualEditor.unmappedOverlapping",
    /**
     * ⭐ G6 — "we found it, and it cannot be written here". The only refusal that is
     * about the SOURCE rather than about our confidence, so it is the only one where
     * telling the user to try again would be a lie. The copy points at the chat, which
     * can do what the editor cannot.
     */
    unsupported: "workspace.visualEditor.unmappedUnsupported",
};

/**
 * ⭐ G3/M2 — EVERY FAILURE USED TO SAY THE SAME SENTENCE.
 *
 * `use-visual-editor` has always captured the real code; the bar rendered a constant
 * over the top of it. So a free-plan refusal, a rebuild already running, an unreadable
 * file tree and a dropped connection were one message — "Nothing was written — try
 * again" — and retrying fixed none of them. That message was also untrue on the
 * network path, where files may well have been written before the connection died.
 */
const ERROR_MESSAGE: Record<string, TranslationKey> = {
    FREE_PLAN_NO_SOURCE_EDITING: "workspace.visualEditor.errorPlanRequired",
    PLAN_REQUIRED: "workspace.visualEditor.errorPlanRequired",
    REBUILD_RUNNING: "workspace.visualEditor.errorRebuildRunning",
    TREE_UNAVAILABLE: "workspace.visualEditor.errorTreeUnavailable",
    READ_FAILED: "workspace.visualEditor.errorTreeUnavailable",
    NO_SOURCE_FILES: "workspace.visualEditor.errorNoSourceFiles",
    AGENT_RUNNING: "workspace.visualEditor.errorAgentRunning",
    NETWORK: "workspace.visualEditor.errorNetwork",
    REBUILD_FAILED: "workspace.visualEditor.errorRebuildFailed",
    REBUILD_TIMEOUT: "workspace.visualEditor.errorRebuildTimeout",
    REBUILD_NOT_FOUND: "workspace.visualEditor.errorRebuildNotFound",
    REBUILD_OK_APP_DOWN: "workspace.visualEditor.errorAppDown",
    UNSAFE_WRITE: "workspace.visualEditor.errorUnsafeWrite",
    WRITE_NOT_FAITHFUL: "workspace.visualEditor.errorWriteNotFaithful",
};

/**
 * ⚠️ G4 — RETRY IS HIDDEN FOR THESE. Offering "Try again" on a failure that cannot
 * succeed on a retry is worse than offering nothing: it costs the user another wait to
 * learn what we already know. `WRITE_NOT_FAITHFUL` means the write endpoint is not
 * returning what it is sent, and `PLAN_REQUIRED` means they are not entitled — neither
 * changes between one press and the next.
 */
const NO_RETRY: string[] = ["WRITE_NOT_FAITHFUL", "FREE_PLAN_NO_SOURCE_EDITING", "PLAN_REQUIRED"];

/**
 * ⭐ G3/N3 — UNIT-BEARING LABELS, NOT `{count} changes`.
 *
 * The bar read "1 changes written to 1 files" in English and "1 cambios visuales sin
 * guardar" in Spanish. Phase 16 hit this exact trap on the credit copy and settled the
 * pattern: build the noun phrase in ONE place so both languages stay grammatical
 * without a plural key per string, and let the prose interpolate it.
 */
function changeLabel(t: ReturnType<typeof useT>, count: number): string {
    return t(count === 1 ? "workspace.visualEditor.oneChange" : "workspace.visualEditor.nChanges", {
        count,
    });
}

function fileLabel(t: ReturnType<typeof useT>, count: number): string {
    return t(count === 1 ? "workspace.visualEditor.oneFile" : "workspace.visualEditor.nFiles", {
        count,
    });
}

/**
 * The three stages of an apply, in order. `applying` covers the first (resolve +
 * write); `rebuilding` covers the second and third, which upstream does not report
 * separately — so the third is shown as still-to-come rather than faked as active.
 */
const ROLE_LABEL: Record<ElementRole, TranslationKey> = {
    heading: "workspace.visualEditor.roleHeading",
    paragraph: "workspace.visualEditor.roleParagraph",
    button: "workspace.visualEditor.roleButton",
    link: "workspace.visualEditor.roleLink",
    image: "workspace.visualEditor.roleImage",
    video: "workspace.visualEditor.roleVideo",
    listItem: "workspace.visualEditor.roleListItem",
    label: "workspace.visualEditor.roleLabel",
    quote: "workspace.visualEditor.roleQuote",
    element: "workspace.visualEditor.roleElement",
};

const ASPECT_LABEL: Record<ChangeAspect, TranslationKey> = {
    text: "workspace.visualEditor.aspectText",
    size: "workspace.visualEditor.aspectSize",
    textColor: "workspace.visualEditor.aspectTextColor",
    bgColor: "workspace.visualEditor.aspectBgColor",
    style: "workspace.visualEditor.aspectStyle",
    media: "workspace.visualEditor.aspectMedia",
};

const APPLY_STEPS: { key: string; label: TranslationKey }[] = [
    { key: "write", label: "workspace.visualEditor.stepWrite" },
    { key: "build", label: "workspace.visualEditor.stepBuild" },
    { key: "reload", label: "workspace.visualEditor.stepReload" },
];

export interface VisualChangesBarProps {
    changes: VisualChange[];
    phase: ApplyPhase;
    outcome: ApplyOutcome | null;
    error: string | null;
    onUndo: (id: string) => void;
    onDiscardAll: () => void;
    onApply: () => void;
    onDismissOutcome: () => void;
}

export function VisualChangesBar({
    changes,
    phase,
    outcome,
    error,
    onUndo,
    onDiscardAll,
    onApply,
    onDismissOutcome,
}: VisualChangesBarProps) {
    const t = useT();
    const [expanded, setExpanded] = React.useState(false);
    const [confirmDiscard, setConfirmDiscard] = React.useState(false);

    /**
     * ⭐⭐ G5 — WHICH CHANGE FAILED, NOT HOW MANY.
     *
     * ⚠️⚠️ THE REPORT USED TO BE UNACTIONABLE, AND A REAL USER SAID SO: "10 changes
     * could not be placed" followed by three reasons, over a list of twelve edits that
     * all looked fine. There was no way to tell WHICH ten — so the only available
     * response was to discard everything and start again.
     *
     * The failed changes are still in the list (apply only clears the ones that landed),
     * so the reason belongs on the row it describes. The list also opens itself when
     * something failed: a collapsed list is where this information goes to die.
     */
    const failureByChange = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const item of outcome?.unmapped ?? []) map.set(item.changeId, item.reason);
        return map;
    }, [outcome]);

    React.useEffect(() => {
        if ((outcome?.unmapped.length ?? 0) > 0) setExpanded(true);
    }, [outcome]);

    const busy = phase === "applying" || phase === "rebuilding";
    const hasChanges = changes.length > 0;
    const canRetry = hasChanges && !busy && !NO_RETRY.includes(error ?? "");

    // Nothing pending and nothing to report ⇒ the bar does not exist.
    if (!hasChanges && !busy && !outcome && !error) return null;

    return (
        <div
            className="border-border/60 bg-card/95 supports-[backdrop-filter]:bg-card/80 shrink-0 border-t backdrop-blur-sm"
            role="region"
            aria-label={t("workspace.visualEditor.barLabel")}
        >
            {/* ── The outcome of the last apply ──────────────────────────── */}
            {(outcome || error) && !busy && (
                <div className="border-border/60 flex items-start gap-2 border-b px-3 py-2 text-xs">
                    {error ? (
                        <>
                            <AlertTriangleIcon className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
                            <p className="min-w-0 flex-1">
                                {t(ERROR_MESSAGE[error] ?? "workspace.visualEditor.applyFailed")}
                            </p>
                        </>
                    ) : (
                        <>
                            {/*
                              ⚠️ G3/N1 — A GREEN TICK OVER "0 changes written" IS A LIE.
                              The icon now follows the outcome: applied nothing ⇒ warn.
                            */}
                            {outcome!.applied.length > 0 ? (
                                /*
                                  ⭐ G4 — THE SUCCESS MOMENT. A rebuild is minutes of
                                  waiting; the payoff should register. The tick scales in
                                  once (motion-safe, so `prefers-reduced-motion` gets the
                                  same information with no movement) and sits on the
                                  success surface rather than being a grey glyph.
                                */
                                <span
                                    aria-hidden
                                    className="bg-success-subtle text-success mt-0.5 grid size-5 shrink-0 place-items-center rounded-full motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300"
                                >
                                    <CheckIcon className="size-3.5" />
                                </span>
                            ) : (
                                <AlertTriangleIcon
                                    className="text-warning mt-0.5 size-4 shrink-0"
                                    aria-hidden
                                />
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                                {outcome!.applied.length > 0 && (
                                    <p className="text-foreground text-sm font-medium">
                                        {t("workspace.visualEditor.appliedTitle")}
                                    </p>
                                )}
                                <p>
                                    {outcome!.applied.length === 0
                                        ? t("workspace.visualEditor.appliedNone")
                                        : t("workspace.visualEditor.appliedCount", {
                                              changes: changeLabel(t, outcome!.applied.length),
                                              files: fileLabel(t, outcome!.filesWritten),
                                          })}
                                </p>
                                {/*
                                  ⚠️ REFUSALS ARE SHOWN, NEVER SWALLOWED. The brief is
                                  explicit: a change we could not map to a file edit must
                                  be said out loud, with the reason.
                                */}
                                {outcome!.unmapped.length > 0 && (
                                    <div className="text-warning-subtle-foreground space-y-0.5">
                                        <p>
                                            {t(
                                                outcome!.unmapped.length === 1
                                                    ? "workspace.visualEditor.unmappedSummary"
                                                    : "workspace.visualEditor.unmappedSummaryMany",
                                                { change: changeLabel(t, outcome!.unmapped.length) }
                                            )}
                                        </p>
                                        {/*
                                          ⚠️ G3/N2 — ONE LINE PER DISTINCT REASON. It used
                                          to render `unmapped[0]` for all of them, so three
                                          refusals with three different causes reported one.
                                        */}
                                        <ul className="list-disc space-y-0.5 pl-4">
                                            {[...new Set(outcome!.unmapped.map(item => item.reason))].map(
                                                reason => (
                                                    <li key={reason}>
                                                        {t(
                                                            UNMAPPED_REASON[reason] ??
                                                                "workspace.visualEditor.unmappedNotFound"
                                                        )}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                )}
                                {/* ⚠️ G3/N1 — only when something WAS written, or this
                                    contradicts the line above it. */}
                                {outcome!.rebuildStarted === false && outcome!.filesWritten > 0 && (
                                    <p className="text-warning-subtle-foreground">
                                        {t("workspace.visualEditor.rebuildNotStarted")}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                    <div className="flex shrink-0 items-center gap-1">
                        {/*
                          ⚠️ RETRY IS OFFERED ONLY WHEN THE CHANGES ARE STILL HERE.
                          `apply` keeps every change that did not land, so after a
                          failure there is something to retry; after a full success the
                          list is empty and a retry button would do nothing.
                        */}
                        {error && canRetry && (
                            <Button size="sm" className="h-6 text-xs" onClick={onApply}>
                                {t("common.retry")}
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onDismissOutcome}>
                            {t("common.dismiss")}
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Progress: what is happening, not just that something is ── */}
            {busy && (
                <div className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                        <LoaderIcon
                            className="text-primary size-4 shrink-0 motion-safe:animate-spin"
                            aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                                {t(
                                    phase === "applying"
                                        ? "workspace.visualEditor.applying"
                                        : "workspace.visualEditor.rebuilding"
                                )}
                            </p>
                            <p className="text-muted-foreground text-xs">
                                {t(
                                    phase === "applying"
                                        ? "workspace.visualEditor.applyingHint"
                                        : "workspace.visualEditor.rebuildingHint"
                                )}
                            </p>
                        </div>
                    </div>

                    {/*
                      ⭐ G4 — THE THREE STEPS, NAMED. A rebuild is 1-4 minutes of
                      nothing visible happening; a bare spinner for that long reads as
                      "stuck". Naming the stage the user is in — and showing the two
                      still to come — is the difference between waiting and worrying.
                      `aria-live` announces each transition once.
                    */}
                    <ol
                        className="text-muted-foreground mt-3 space-y-1 text-xs"
                        aria-live="polite"
                    >
                        {APPLY_STEPS.map((step, index) => {
                            const activeIndex = phase === "applying" ? 0 : 1;
                            const state =
                                index < activeIndex ? "done" : index === activeIndex ? "active" : "todo";
                            return (
                                <li key={step.key} className="flex items-center gap-2">
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "grid size-4 shrink-0 place-items-center rounded-full border text-[9px]",
                                            state === "done" && "border-success/40 bg-success-subtle text-success",
                                            state === "active" && "border-primary bg-primary-subtle text-primary",
                                            state === "todo" && "border-border text-muted-foreground/50"
                                        )}
                                    >
                                        {state === "done" ? "✓" : index + 1}
                                    </span>
                                    <span className={cn(state === "active" && "text-foreground font-medium")}>
                                        {t(step.label)}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>

                    {phase === "rebuilding" && (
                        <p className="text-muted-foreground/80 mt-2 text-[11px]">
                            {t("workspace.visualEditor.rebuildLeaveHint")}
                        </p>
                    )}
                </div>
            )}

            {/* ── The pending list ───────────────────────────────────────── */}
            {hasChanges && !busy && (
                <>
                    {/*
                      ⚠️ G3/N4 — THE BUTTONS GET THEIR OWN ROW BELOW `sm`.
                      Measured at 375px: the label `<p min-w-0 flex-1>` was competing
                      with three buttons on one flex row and collapsed to a 16px column
                      wrapping over four lines. Stacking is the only thing that fits.
                    */}
                    <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <div className="flex min-w-0 items-center gap-2">
                        <span className="bg-primary-subtle text-primary-subtle-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
                            {changes.length}
                        </span>
                        <p className="min-w-0 flex-1 text-sm font-medium">
                            {t("workspace.visualEditor.unsavedLabel", {
                                changes: changeLabel(t, changes.length),
                            })}
                        </p>

                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setExpanded(value => !value)}
                                aria-expanded={expanded}
                            >
                                {t(expanded ? "workspace.visualEditor.hideList" : "workspace.visualEditor.showList")}
                            </Button>
                            {/*
                              ⭐ G4 — CONFIRMED, because it is the only irreversible
                              control here. Every other action in this bar can be undone
                              (per-change undo) or repeated (Apply); throwing away a
                              batch of edits cannot.
                            */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setConfirmDiscard(true)}
                            >
                                {t("workspace.visualEditor.discardAll")}
                            </Button>
                            {/*
                              ⚠️ G3/M3 — DISABLED WHILE A REQUEST IS IN FLIGHT. The real
                              guard is the ref inside `apply()`; this stops the button
                              looking clickable in the moment before React re-renders.
                            */}
                            <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={onApply}
                                disabled={busy}
                            >
                                {t("workspace.visualEditor.apply")}
                            </Button>
                        </div>
                    </div>

                    {expanded && (
                        <ul className="divide-border/60 border-border/60 max-h-40 divide-y overflow-y-auto border-t">
                            {changes.map(change => {
                                const summary = describeChange(change);
                                const aspects = aspectsOf(change);
                                const aspect = aspects[0];
                                /**
                                 * ⭐ G4 — every aspect, joined. The first keeps its own
                                 * casing because it may open the label (EN "{role} {aspect}"
                                 * puts it last, ES "{aspect} · {role}" puts it first); the
                                 * rest are lowercased so ES reads "Tamaño y color" and not
                                 * "Tamaño y Color".
                                 */
                                const aspectText = aspects
                                    .map((item, index) => {
                                        const word = t(ASPECT_LABEL[item]);
                                        return index === 0 ? word : word.toLocaleLowerCase();
                                    })
                                    .reduce((joined, word, index) =>
                                        index === 0
                                            ? word
                                            : index === aspects.length - 1
                                              ? `${joined}${t("workspace.visualEditor.aspectJoin")}${word}`
                                              : `${joined}, ${word}`
                                    );
                                /**
                                 * ⭐ G4 — "Heading size", not a truncated class string.
                                 * The list used to render the raw `className` diff, so
                                 * three different edits to one element looked identical
                                 * and the meaningful token was cut off by the ellipsis.
                                 */
                                const label = t("workspace.visualEditor.changeLabel", {
                                    role: t(ROLE_LABEL[roleOf(change.signature)]),
                                    aspect: aspectText,
                                });
                                /** G5 — the reason THIS row was refused by the last apply. */
                                const failure = failureByChange.get(change.id);
                                return (
                                    <li key={change.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                                        {failure && (
                                            <AlertTriangleIcon
                                                className="text-warning size-3.5 shrink-0"
                                                aria-hidden
                                            />
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium" title={change.signature.breadcrumb}>
                                                {label}
                                            </span>
                                            {/* The literal diff stays, one step down the
                                                hierarchy — useful when it is short (text),
                                                noise when it is long (classes). ⚠️ G5: a
                                                refused change shows WHY here instead, which
                                                is the only place the user can act on it. */}
                                            <span
                                                className={cn(
                                                    "block truncate text-[11px]",
                                                    failure ? "text-warning-subtle-foreground" : "text-muted-foreground"
                                                )}
                                            >
                                                {failure ? (
                                                    t(
                                                        UNMAPPED_REASON[failure] ??
                                                            "workspace.visualEditor.unmappedNotFound"
                                                    )
                                                ) : aspect === "text" || aspect === "media" ? (
                                                    <>
                                                        <span className="line-through">{summary.from}</span>
                                                        {" → "}
                                                        <span>{summary.to}</span>
                                                    </>
                                                ) : (
                                                    t("workspace.visualEditor.changeOn", {
                                                        element: change.signature.breadcrumb.split(" › ").pop() ?? "",
                                                    })
                                                )}
                                            </span>
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-6 shrink-0"
                                            onClick={() => onUndo(change.id)}
                                            aria-label={t("workspace.visualEditor.undoOneNamed", { change: label })}
                                        >
                                            <Undo2Icon className="size-3.5" aria-hidden />
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}

            <ConfirmDialog
                open={confirmDiscard}
                onOpenChange={setConfirmDiscard}
                title={t("workspace.visualEditor.discardConfirmTitle")}
                description={t("workspace.visualEditor.discardConfirmBody", {
                    changes: changeLabel(t, changes.length),
                })}
                confirmLabel={t("workspace.visualEditor.discardAll")}
                tone="danger"
                onConfirm={() => {
                    onDiscardAll();
                    setConfirmDiscard(false);
                }}
            />
        </div>
    );
}
