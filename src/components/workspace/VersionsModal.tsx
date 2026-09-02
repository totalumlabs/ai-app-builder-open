"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, FileDiffIcon, HistoryIcon, RotateCcwIcon } from "lucide-react";
import { ConfirmDialog, EmptyState, ErrorState, Modal, SkeletonList } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n";
import { formatRelativeDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { ProjectVersion } from "@/lib/vcaas-types";

/**
 * VERSION HISTORY.
 *
 * Every change that touches the code leaves a restorable snapshot — an agent run,
 * a file saved by hand in the code editor, a GitHub pull, an import. This lists
 * them, shows what produced each, links to its diff, and restores behind a typed
 * confirmation.
 *
 * ⚠️ "VIEW CHANGES" HANGS OFF `commitSha`, NOT `commitMessage`. It used to be
 * gated on the latter and to PASS the latter to the diff viewer, which is wrong
 * twice over: `commitMessage` is a human sentence, not a URL, so the viewer
 * answered "this diff was saved in an older format"; and versions that carry no
 * message — every **manual code edit**, which is saved as `Manual code edit` with
 * no commit message at all — showed no button whatsoever. `commitSha` is the field
 * that actually identifies the change, it is on every version made since the move
 * to git-based snapshots, and `versions.diff()` turns it into a patch.
 *
 * ⚠️ RESTORING COSTS CREDITS (`VCAAS_CREDIT_COSTS.RECOVER_VERSION`) **and
 * overwrites the current code**. Both facts are on screen before the button that
 * does it.
 *
 * ⚠️ IT IS A PLAIN CONFIRMATION, NOT A TYPED ONE — deliberately downgraded. It
 * used to demand that you type the version's name, the ceremony this codebase
 * reserves for deletes, and that was the wrong reading of the risk: what a
 * restore overwrites is ITSELF a version (every run, manual edit, GitHub pull and
 * import leaves one), so the way out of a mis-restore is another restore. Nothing
 * is destroyed. Charging the same ceremony for a reversible action as for an
 * irreversible one is how confirmations stop being read.
 */

const PAGE_SIZE = 10;

export interface VersionsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    /**
     * ═══⭐⭐ RESTORING IS A LONG OPERATION, NOT A REQUEST ════════════════════
     *
     * ⚠️⚠️ `POST …/versions/{id}/recover` RETURNS WHEN THE RECOVERY IS REGISTERED,
     * NOT WHEN IT IS DONE. Upstream then rewrites the project's files on the sandbox
     * and on GCS for one to four minutes, and says so in the 409 it gives anyone who
     * tries something else meanwhile: *"Recoveries take 1-4 minutes — poll GET
     * /projects/:projectId until `versionRecovery` is null"*.
     *
     * This modal used to toast "Version restored", close, and refresh a preview that
     * was still serving the version being replaced. The request is now started by the
     * shell, which owns the banner, the chat lock and the polling — see
     * `@/lib/project-operation`.
     *
     * ⚠️ IT MUST THROW ON FAILURE. `ConfirmDialog` keeps itself open on a rejected
     * promise; resolving would close the dialog as though the restore had been taken.
     */
    onRestore: (version: ProjectVersion) => Promise<void>;
    /** A restore is already in flight — started here, or in another tab, or by a teammate. */
    restoring: boolean;
    /**
     * Another long operation is running, as an already-translated sentence. The row
     * stays pressable and says this instead — never a dead button with no reason.
     */
    blockedReason?: string | null;
    /**
     * Open the diff viewer for a version's changes.
     *
     * ⚠️ THE WHOLE VERSION, NOT ITS `commitSha`. The shell also knows whether the run
     * that produced this snapshot uploaded a patch, and that route works while the
     * project is asleep — which is when version history is usually opened. Passing
     * only the sha threw that away and made every diff depend on a running sandbox.
     */
    onViewDiff: (version: ProjectVersion) => void;
    /**
     * The patch the run that made this version uploaded, if the conversation still
     * carries one. Used only to decide whether "View changes" can lead anywhere —
     * the shell fetches it.
     */
    storedPatchFor: (versionId: string) => string | undefined;
}

export function VersionsModal({
    open,
    onOpenChange,
    projectId,
    onRestore,
    restoring,
    blockedReason = null,
    onViewDiff,
    storedPatchFor,
}: VersionsModalProps) {
    const t = useT();
    const { locale } = useLocale();

    const [versions, setVersions] = React.useState<ProjectVersion[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(0);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    /** The version whose confirmation is open. Not "a restore is running" — see `restoring`. */
    const [confirming, setConfirming] = React.useState<ProjectVersion | null>(null);

    const mounted = React.useRef(true);
    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);

        const response = await vcaasApi.versions.list(projectId, {
            limit: PAGE_SIZE,
            skip: page * PAGE_SIZE,
        });

        if (!mounted.current) return;

        if (response.ok && response.data) {
            setVersions(response.data.versions || []);
            setTotal(response.data.totalCount ?? 0);
        } else {
            setError(response.error || t("workspace.versions.loadFailedDescription"));
            setVersions([]);
        }
        setLoading(false);
    }, [projectId, page, t]);

    // Fetch when the modal opens (and on page change) — never on mount, since the
    // trigger may never be clicked.
    React.useEffect(() => {
        if (open) void load();
    }, [open, load]);

    React.useEffect(() => {
        if (!open) setPage(0);
    }, [open]);

    /**
     * ⚠️ THE MODAL CLOSES ITSELF ON SUCCESS, AND THAT IS THE RIGHT ENDING NOW. What
     * the user needs next is the BANNER over the preview — the clock, the progress and
     * the locked chat — none of which is visible behind this dialog. A failure leaves
     * everything open (`onRestore` throws), so the list is still there to try again.
     */
    async function handleRestore(version: ProjectVersion) {
        await onRestore(version);
        onOpenChange(false);
    }

    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <>
            <Modal
                open={open}
                onOpenChange={onOpenChange}
                size="lg"
                title={t("workspace.versions.title")}
                description={t("workspace.versions.description")}
            >
                <div className="space-y-3">
                    {loading && <SkeletonList count={5} />}

                    {!loading && error && (
                        <ErrorState
                            variant="panel"
                            title={t("workspace.versions.loadFailed")}
                            description={t("workspace.versions.loadFailedDescription")}
                            detail={error}
                            onRetry={() => void load()}
                        />
                    )}

                    {!loading && !error && versions.length === 0 && (
                        <EmptyState
                            variant="panel"
                            icon={<HistoryIcon />}
                            title={t("workspace.versions.emptyTitle")}
                            description={t("workspace.versions.emptyDescription")}
                        />
                    )}

                    {!loading && !error && versions.length > 0 && (
                        <ul className="space-y-2">
                            {versions.map(version => (
                                <li
                                    key={version._id}
                                    className="border-border hover:border-border-strong rounded-lg border p-3 transition-colors"
                                >
                                    <div className="flex flex-wrap items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-center gap-1.5 text-sm font-medium">
                                                <ClockIcon
                                                    className="text-muted-foreground size-3.5 shrink-0"
                                                    aria-hidden
                                                />
                                                <span className="truncate">{version.name}</span>
                                            </p>
                                            <p className="text-muted-foreground mt-0.5 text-xs">
                                                {formatRelativeDate(version.createdAt, locale)}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1">
                                            {/*
                                              Opens the SAME viewer the chat uses — one diff
                                              implementation, two ways to fetch. See `DiffSource`.

                                              ⚠️ SHOWN WHEN EITHER ROUTE EXISTS, not just the
                                              commit. A pre-git version stored a `files[]`
                                              snapshot and has no `commitSha`, but the run that
                                              made it may still have a patch in the conversation
                                              — gating on the commit alone hid a diff we were
                                              perfectly able to show. When neither exists there
                                              is genuinely nothing behind the button, so it stays
                                              off rather than opening on an error.
                                            */}
                                            {(version.commitSha || storedPatchFor(version._id)) && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 gap-1.5 px-2"
                                                    onClick={() => onViewDiff(version)}
                                                >
                                                    <FileDiffIcon className="size-3.5" aria-hidden />
                                                    <span className="hidden sm:inline">
                                                        {t("workspace.chat.viewChanges")}
                                                    </span>
                                                </Button>
                                            )}
                                            {/*
                                              ⚠️ DISABLED ONLY WHILE A RESTORE IS
                                              ACTUALLY RUNNING. When something else is
                                              (a publish, a rebuild, a restart) the
                                              button still opens — and says which, in a
                                              toast — because a greyed row in the one
                                              dialog you opened to press it explains
                                              nothing. The server refuses the same
                                              combinations with a 409, so this is the
                                              readable version of a rule that exists
                                              either way.
                                            */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 gap-1.5 px-2"
                                                disabled={restoring}
                                                onClick={() => {
                                                    if (blockedReason) {
                                                        toast.info(blockedReason);
                                                        return;
                                                    }
                                                    setConfirming(version);
                                                }}
                                            >
                                                <RotateCcwIcon className="size-3.5" aria-hidden />
                                                {t("workspace.versions.restore")}
                                            </Button>
                                        </div>
                                    </div>

                                    {/*
                                      What produced this version — the only thing that makes a
                                      list of timestamps meaningful.

                                      ⚠️ FALLS BACK TO THE COMMIT MESSAGE. Only agent runs have a
                                      `prompt`, so every other row — a GitHub pull, an import, a
                                      recovery — used to be a bare timestamp. The commit message
                                      is what those carry instead, and showing it costs nothing.
                                      A manual code edit has neither, and its NAME already says
                                      what it is.
                                    */}
                                    {(version.prompt || version.commitMessage) && (
                                        <p className="text-muted-foreground bg-muted/50 mt-2 line-clamp-2 rounded-md p-2 text-xs">
                                            {version.prompt || version.commitMessage}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}

                    {!loading && !error && pageCount > 1 && (
                        <nav className="flex items-center justify-between gap-2 pt-1">
                            <p className="text-muted-foreground text-xs">
                                {t("pages.projects.pageOf", { page: page + 1, total: pageCount })}
                            </p>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    disabled={page === 0}
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                >
                                    <ChevronLeftIcon className="size-3.5" aria-hidden />
                                    <span className="sr-only">{t("common.previous")}</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    disabled={page + 1 >= pageCount}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    <ChevronRightIcon className="size-3.5" aria-hidden />
                                    <span className="sr-only">{t("common.next")}</span>
                                </Button>
                            </div>
                        </nav>
                    )}
                </div>
            </Modal>

            <ConfirmDialog
                open={!!confirming}
                onOpenChange={openState => {
                    if (!openState) setConfirming(null);
                }}
                tone="danger"
                title={t("workspace.versions.restoreTitle", { name: confirming?.name ?? "" })}
                description={t("workspace.versions.restoreDescription")}
                confirmLabel={t("workspace.versions.restore")}
                /*
                 * ⚠️ NO TYPED PHRASE. Restoring used to require typing the version's
                 * name, which is the ceremony reserved for deletes — and it is the
                 * wrong instrument here: a restore does not destroy anything that
                 * cannot be got back. The state it overwrites is itself a version
                 * (every run, manual edit, pull and import leaves one), so the way
                 * out of a mis-restore is another restore. Making the common,
                 * reversible action as expensive as the irreversible ones is how a
                 * confirmation stops being read at all.
                 *
                 * The dialog still states both facts — it overwrites the current
                 * code, and it costs credits — and it is still `tone="danger"`.
                 */
                onConfirm={async () => {
                    if (confirming) await handleRestore(confirming);
                }}
            />
        </>
    );
}
