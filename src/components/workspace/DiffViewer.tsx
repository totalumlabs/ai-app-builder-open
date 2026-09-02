"use client";

import * as React from "react";
import {
    ChevronDownIcon,
    ChevronRightIcon,
    FileDiffIcon,
    FoldVerticalIcon,
    LoaderIcon,
    UnfoldVerticalIcon,
} from "lucide-react";
import { CopyButton, EmptyState, ErrorState, Modal, StatusPill, type StatusTone } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { ServerWakeNotice } from "./ServerWakeNotice";
import { useServerWake } from "./use-server-wake";
import type { TranslationKey } from "@/i18n";
import { diffTotals, parseDiff, segmentLine, type DiffFile, type DiffLine, type LineKind } from "@/lib/diff-parse";
import { vcaasApi } from "@/lib/vcaas";
import { cn } from "@/lib/utils";

/**
 * THE DIFF VIEWER — what the agent actually changed.
 *
 * ── HOW THE PATCH IS FETCHED ────────────────────────────────────────────────
 *
 * `gitDiffUrl` on a conversation message points at EXTERNAL signed storage. The
 * browser cannot fetch it (CORS), and we would not want it to: an unrestricted
 * client fetch of a server-supplied URL is an open redirect waiting to happen.
 * It goes through `/api/vcaas/git-diff`, which is session-gated and keeps the
 * **SSRF allow-list** built in Phase 06. That route is unchanged here.
 *
 * ── COLOURS THAT SURVIVE DARK MODE ──────────────────────────────────────────
 *
 * Diff colours are the one place a design system usually breaks: `bg-green-50` is
 * invisible on a dark background, and `bg-green-900` is unreadable on a light one.
 * Every colour below is an explicit light/dark pair, and the WORD-LEVEL highlight
 * is a *stronger* shade of the same hue so it reads as emphasis inside the row
 * rather than as a different kind of change.
 *
 * ── WORD-LEVEL HIGHLIGHTING ─────────────────────────────────────────────────
 *
 * The reference implementation does not have this. Without it, a one-character
 * change renders as two nearly identical rows and the reader has to diff them by
 * eye — which is the job they came here to avoid. See `diff-parse.ts` for the
 * algorithm and why it is prefix/suffix trimming rather than a full LCS.
 */

/** Files beyond this are collapsed initially, so a huge patch still opens fast. */
const AUTO_EXPAND_LIMIT = 10;

const STATUS_TONE: Record<DiffFile["status"], { tone: StatusTone; labelKey: TranslationKey }> = {
    added: { tone: "success", labelKey: "workspace.diff.statusAdded" },
    deleted: { tone: "danger", labelKey: "workspace.diff.statusDeleted" },
    renamed: { tone: "info", labelKey: "workspace.diff.statusRenamed" },
    modified: { tone: "warning", labelKey: "workspace.diff.statusModified" },
};

/** Row backgrounds. Explicit light/dark pairs — see the header note. */
const LINE_BG: Record<LineKind, string> = {
    add: "bg-emerald-50 dark:bg-emerald-950/40",
    del: "bg-rose-50 dark:bg-rose-950/40",
    context: "",
    hunk: "bg-muted text-muted-foreground select-none",
    meta: "text-muted-foreground italic",
};

/** The changed span inside a row — a stronger shade of the row's own hue. */
const WORD_BG: Partial<Record<LineKind, string>> = {
    add: "bg-emerald-200/70 dark:bg-emerald-700/50 rounded-[2px]",
    del: "bg-rose-200/70 dark:bg-rose-700/50 rounded-[2px]",
};

const SIGN: Record<LineKind, string> = { add: "+", del: "-", context: " ", hunk: "", meta: "" };

/**
 * ⭐ TWO WAYS TO GET THE SAME PATCH, TRIED IN ORDER. ONE VIEWER.
 *
 * `url`       — a conversation message's `gitDiffUrl`: the patch the agent uploaded
 *               to signed storage when the run ended, fetched through the
 *               SSRF-guarded proxy above. Works with the project asleep.
 * `commitSha` — regenerate it with `git diff` on the sandbox. Works forever, but
 *               only while the sandbox is awake.
 *
 * ⚠️ NEITHER ONE ALONE IS ENOUGH, AND THAT IS WHY "VIEW CHANGES" KEPT FAILING.
 *
 * The stored patch is NOT kept: totalum-backend's `cleanupOldDiffs` prunes each
 * organisation's diff bucket to the newest 30 objects on every upload. The signed
 * URL stays valid for two years, so the link on an older run looks perfectly fine
 * and answers **404** — which surfaced as "the patch couldn't be downloaded, it may
 * have expired". The word "expired" was the one wrong guess: the URL had not
 * expired, the file had been deleted.
 *
 * And the sandbox route needs a machine that is running. Open version history on a
 * project you have not touched today — the normal reason to open version history —
 * and every single "View changes" answered `NO_ACTIVE_SANDBOX`.
 *
 * Together they cover each other: an old run's deleted patch is rebuilt from its
 * commit, and a sleeping project still shows any patch that was stored. Only when
 * BOTH are unavailable is there an error, and then it says which one.
 *
 * ⚠️ `versionId` IS THE BRIDGE. A chat message knows its `gitDiffUrl` and its
 * `versionId` but not its commit; a version knows its commit. When the stored patch
 * is gone and all we have is the version id, `resolveCommitSha` looks the commit up
 * in the version list — bounded, and only on the failure path.
 */
export interface DiffSource {
    projectId: string;
    /** The stored patch, when the run that produced it uploaded one. */
    url?: string;
    /** The commit to rebuild the patch from, when it is known up front. */
    commitSha?: string;
    /** The snapshot this diff belongs to — used to find `commitSha` if needed. */
    versionId?: string;
}

/** How many versions to page through looking for a `versionId`'s commit. */
const VERSION_LOOKUP_PAGE = 50;
const VERSION_LOOKUP_MAX_PAGES = 4;

/**
 * Find the commit behind a version id.
 *
 * ⚠️ THERE IS NO GET-VERSION-BY-ID ENDPOINT — the list is all there is, so this
 * pages through it. It runs ONLY when the stored patch has already failed, and it
 * stops after 200 versions rather than walking the entire history of a project that
 * has been built a thousand times.
 */
async function resolveCommitSha(projectId: string, versionId: string): Promise<string | null> {
    for (let page = 0; page < VERSION_LOOKUP_MAX_PAGES; page += 1) {
        const response = await vcaasApi.versions.list(projectId, {
            limit: VERSION_LOOKUP_PAGE,
            skip: page * VERSION_LOOKUP_PAGE,
        });
        if (!response.ok || !response.data) return null;

        const versions = response.data.versions || [];
        const match = versions.find(version => version._id === versionId);
        if (match?.commitSha) return match.commitSha;

        if (versions.length < VERSION_LOOKUP_PAGE) return null;
    }
    return null;
}

export interface DiffViewerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Where to get the patch, or `null` when the viewer is closed. */
    source: DiffSource | null;
}

/**
 * Why a patch could not be shown — chosen so the message on screen names the
 * ACTUAL obstacle and, where there is one, the action that clears it.
 *
 * ⚠️ EVERY FAILURE USED TO READ "it may have expired", INCLUDING THE ONES THAT HAD
 * NOTHING TO DO WITH EXPIRY — a sleeping project, a version with no textual
 * changes, a malformed request. A single guess covering four causes is worse than
 * no explanation: it sends the one user who could have fixed it (wake the project)
 * off to wait for something to un-expire.
 */
type FailureReason = "sleeping" | "gone" | "unknown";

interface LoadFailure {
    reason: FailureReason;
    /** The upstream sentence. Shown only in development, as everywhere else. */
    detail: string;
}

const FAILURE_COPY: Record<FailureReason, { title: TranslationKey; description: TranslationKey }> = {
    sleeping: {
        title: "workspace.diff.failedSleepingTitle",
        description: "workspace.diff.failedSleepingDescription",
    },
    gone: {
        title: "workspace.diff.failedGoneTitle",
        description: "workspace.diff.failedGoneDescription",
    },
    unknown: {
        title: "workspace.diff.loadFailed",
        description: "workspace.diff.loadFailedDescription",
    },
};

export function DiffViewer({ open, onOpenChange, source }: DiffViewerProps) {
    const t = useT();
    /**
     * ⭐ THE DIFF IS COMPUTED BY `git` ON THE SANDBOX, so an archived project cannot
     * produce one. VCaaS now starts the server and answers `SERVER_NOT_READY`; this
     * turns that into the waking strip and re-runs the load when it is up, instead of
     * the "your project is asleep" dead end below.
     */
    const wake = useServerWake(source?.projectId ?? "");
    const [raw, setRaw] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [failure, setFailure] = React.useState<LoadFailure | null>(null);
    const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

    /**
     * ⚠️ THE TWO ROUTES ARE TRIED IN SEQUENCE, NOT CHOSEN BETWEEN. See the note on
     * `DiffSource` — the stored patch gets deleted and the sandbox goes to sleep,
     * so either one alone fails routinely and the pair almost never does.
     *
     * The response shape is `{ diff }` either way, so everything below the fetch is
     * identical — which is what keeps this one viewer rather than two.
     */
    const load = React.useCallback(async () => {
        if (!source) return;
        setLoading(true);
        setFailure(null);

        let failureToReport: LoadFailure | null = null;

        // ── 1. The patch the run uploaded. No sandbox needed. ──────────────
        if (source.url) {
            const response = await vcaasApi.gitDiff(source.url);
            if (response.ok && response.data) {
                setRaw(response.data.diff || "");
                setLoading(false);
                return;
            }
            failureToReport = { reason: "gone", detail: response.error || "" };
        }

        // ── 2. Rebuild it from the commit on the sandbox. ──────────────────
        let commitSha = source.commitSha ?? null;
        if (!commitSha && source.versionId) {
            commitSha = await resolveCommitSha(source.projectId, source.versionId);
        }

        if (commitSha) {
            const response = await vcaasApi.versions.diff(source.projectId, commitSha);

            if (response.ok && response.data) {
                setRaw(response.data.diff || "");
                setLoading(false);
                return;
            }

            /*
              ⚠️ "NO DIFF CONTENT" IS NOT A FAILURE. A version can legitimately
              change nothing textual — a binary asset, a no-op recovery. Reporting
              that as a broken patch tells the user something is wrong with the
              product when the honest answer is "this changed nothing".
            */
            if (response.upstreamCode === "NO_DIFF_CONTENT") {
                setRaw("");
                setLoading(false);
                return;
            }

            /**
             * ⚠️ THE SERVER IS COMING UP — NOT A FAILURE, AND NOT `sleeping` EITHER.
             * `sleeping` is the copy for "wake it yourself"; this one is already
             * waking, so the strip says so and the load repeats on its own.
             */
            if (wake.claim(response, () => void loadRef.current())) {
                setLoading(false);
                return;
            }

            failureToReport = {
                reason: response.upstreamCode === "NO_ACTIVE_SANDBOX" ? "sleeping" : "unknown",
                detail: response.error || "",
            };
        }

        setRaw(null);
        setFailure(failureToReport ?? { reason: "unknown", detail: "" });
        setLoading(false);
        /**
         * ⚠️⚠️ `wake.claim`, NOT `wake`. The hook's object is memoised, but `elapsedMs`
         * is part of it, so its identity legitimately changes ONCE A SECOND for as long
         * as a wake is running. `load` is in the dependency array of the effect below,
         * and that effect calls `load()` — so depending on the whole object re-fetched
         * the patch every second during the two-to-four minutes the sandbox takes to
         * come up, and each refusal re-`claim`ed, which restarted the clock and pinned
         * the progress bar at zero. `claim` is `useCallback`-stable, and it is the only
         * member this callback touches.
         */
    }, [source, wake.claim]);

    /**
     * ⚠️ THE RETRY GOES THROUGH A REF — a `useCallback` cannot name itself in its own
     * dependency array, and the wake resolves minutes after `load` returned.
     */
    const loadRef = React.useRef(load);
    loadRef.current = load;

    /**
     * Fetch when the modal opens, not on mount — the trigger lives in a chat message
     * that may never be clicked, and each patch is a real download.
     *
     * ═══⭐⭐⭐ `load` IS CALLED THROUGH THE REF AND IS *NOT* A DEPENDENCY ═════════
     *
     * ⚠️⚠️ THIS IS THE EFFECT THAT TOOK PRODUCTION DOWN. `load` is a `useCallback`, so
     * the moment ANY of its dependencies loses identity stability it is rebuilt on every
     * render — and with it in the array, this effect re-runs on every render and calls
     * `load()` again. Both branches then feed the loop: the open branch fires a real
     * `git diff` request per render (the user saw an endless stream of them until the tab
     * died), and the closed branch calls `setCollapsed(new Set())`, a fresh Set every
     * time, so React never settles. The result is "Minified React error #185 — Maximum
     * update depth exceeded", and because the tree never commits, nothing else on the
     * page works either: the project menu's Dashboard link looked dead because the
     * navigation could not commit, not because the link was wrong.
     *
     * It has happened twice for two different reasons (an unmemoised `useServerWake`
     * object, then that object's one-second `elapsedMs` tick), which is the argument for
     * fixing it HERE rather than only upstream: the ref makes the effect depend on the
     * two things that should actually re-trigger a fetch — the modal opening, and the
     * patch it points at — and on nothing else. `loadRef.current` is reassigned on every
     * render just above, so the call is always the freshest `load`.
     *
     * ⚠️ `react-hooks/exhaustive-deps` IS DISABLED IN THIS REPO (see `eslint.config.mjs`),
     * so nothing will warn you if you "helpfully" put `load` back in the array. Do not.
     */
    React.useEffect(() => {
        if (open && source) void loadRef.current();
        if (!open) {
            setRaw(null);
            setFailure(null);
            setCollapsed(new Set());
        }
    }, [open, source]);

    const files = React.useMemo(() => (raw ? parseDiff(raw) : []), [raw]);
    const totals = React.useMemo(() => diffTotals(files), [files]);

    // Big patches start collapsed beyond the first few files.
    React.useEffect(() => {
        if (files.length > AUTO_EXPAND_LIMIT) {
            setCollapsed(new Set(files.slice(AUTO_EXPAND_LIMIT).map(file => file.path)));
        }
    }, [files]);

    const allCollapsed = files.length > 0 && collapsed.size === files.length;

    function toggleAll() {
        setCollapsed(allCollapsed ? new Set() : new Set(files.map(file => file.path)));
    }

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={t("workspace.diff.title")}
            description={
                files.length > 0
                    ? t("workspace.diff.summary", {
                          files: files.length,
                          additions: totals.additions,
                          deletions: totals.deletions,
                      })
                    : undefined
            }
            headerAside={
                files.length > 0 ? (
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2" onClick={toggleAll}>
                            {allCollapsed ? (
                                <UnfoldVerticalIcon className="size-3.5" aria-hidden />
                            ) : (
                                <FoldVerticalIcon className="size-3.5" aria-hidden />
                            )}
                            <span className="hidden sm:inline">
                                {allCollapsed ? t("workspace.diff.expandAll") : t("workspace.diff.collapseAll")}
                            </span>
                        </Button>
                        {raw && <CopyButton value={raw} label={t("workspace.diff.copyPatch")} size="sm" />}
                    </div>
                ) : undefined
            }
            flush
        >
            <div className="tp-scroll max-h-[70vh] min-h-40 space-y-2 overflow-auto p-3 sm:p-4">
                {/* ⭐ The sandbox was asleep; VCaaS is starting it and the diff will
                    load itself when it answers. */}
                {(wake.waking || wake.failed) && (
                    <ServerWakeNotice wake={wake} className="mb-3" />
                )}

                {loading && (
                    <div className="grid place-items-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <LoaderIcon className="text-muted-foreground size-5 animate-spin" aria-hidden />
                            <p className="text-muted-foreground text-sm">{t("workspace.diff.loading")}</p>
                        </div>
                    </div>
                )}

                {!loading && failure && (
                    <ErrorState
                        variant="panel"
                        title={t(FAILURE_COPY[failure.reason].title)}
                        description={t(FAILURE_COPY[failure.reason].description)}
                        detail={failure.detail || undefined}
                        onRetry={() => void load()}
                    />
                )}

                {!loading && !failure && files.length === 0 && (
                    <EmptyState
                        variant="panel"
                        icon={<FileDiffIcon />}
                        title={t("workspace.diff.emptyTitle")}
                        description={t("workspace.diff.emptyDescription")}
                    />
                )}

                {!loading &&
                    !failure &&
                    files.map(file => (
                        <FileBlock
                            key={file.path}
                            file={file}
                            open={!collapsed.has(file.path)}
                            onToggle={() =>
                                setCollapsed(current => {
                                    const next = new Set(current);
                                    if (next.has(file.path)) next.delete(file.path);
                                    else next.add(file.path);
                                    return next;
                                })
                            }
                        />
                    ))}
            </div>
        </Modal>
    );
}

function FileBlock({
    file,
    open,
    onToggle,
}: {
    file: DiffFile;
    open: boolean;
    onToggle: () => void;
}) {
    const t = useT();
    const status = STATUS_TONE[file.status];

    return (
        <div className="border-border overflow-hidden rounded-lg border">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="bg-muted/50 hover:bg-muted focus-visible:ring-ring flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                {open ? (
                    <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                ) : (
                    <ChevronRightIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                )}

                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={file.path}>
                    {file.status === "renamed" && file.oldPath && (
                        <span className="text-muted-foreground">{file.oldPath} → </span>
                    )}
                    {file.path}
                </span>

                <StatusPill tone={status.tone} className="shrink-0">
                    {t(status.labelKey)}
                </StatusPill>

                <span className="shrink-0 font-mono text-[11px] tabular-nums">
                    {file.additions > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
                    )}
                    {file.additions > 0 && file.deletions > 0 && " "}
                    {file.deletions > 0 && (
                        <span className="text-rose-600 dark:text-rose-400">−{file.deletions}</span>
                    )}
                </span>
            </button>

            {open && (
                <div className="tp-scroll overflow-x-auto">
                    {file.isBinary || file.lines.length === 0 ? (
                        <p className="text-muted-foreground px-3 py-2 text-xs italic">
                            {file.isBinary
                                ? t("workspace.diff.binaryFile")
                                : t("workspace.diff.noTextualChanges")}
                        </p>
                    ) : (
                        <table className="w-full border-collapse font-mono text-[11px] leading-[1.6]">
                            <tbody>
                                {file.lines.map((line, index) => (
                                    <DiffRow key={index} line={line} />
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

function DiffRow({ line }: { line: DiffLine }) {
    const segments = segmentLine(line);
    const wordClass = WORD_BG[line.kind];

    return (
        <tr className={LINE_BG[line.kind]}>
            <td className="border-border/60 text-muted-foreground w-10 min-w-10 border-r px-1.5 text-right align-top tabular-nums select-none">
                {line.oldNo ?? ""}
            </td>
            <td className="border-border/60 text-muted-foreground w-10 min-w-10 border-r px-1.5 text-right align-top tabular-nums select-none">
                {line.newNo ?? ""}
            </td>
            <td className="text-muted-foreground w-4 min-w-4 pl-1.5 text-center align-top select-none">
                {SIGN[line.kind]}
            </td>
            <td className="px-1.5 align-top break-all whitespace-pre-wrap">
                {segments.map((segment, index) =>
                    segment.changed && wordClass ? (
                        <span key={index} className={wordClass}>
                            {segment.text}
                        </span>
                    ) : (
                        <React.Fragment key={index}>{segment.text}</React.Fragment>
                    )
                )}
                {/* Keep empty rows from collapsing to zero height. */}
                {line.content === "" && " "}
            </td>
        </tr>
    );
}
