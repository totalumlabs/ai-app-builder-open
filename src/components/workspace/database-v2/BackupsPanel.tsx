"use client";

import * as React from "react";
import { DownloadIcon, LoaderIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { ConfirmDialog, SpinnerBlock } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLocale, useT } from "@/i18n";
import { usePrice } from "@/components/credits/CreditsProvider";
import { backupSize, canRestoreBackup, restoreRunning, retentionParts, scheduleStatus, windowIsShort } from "@/lib/db-backups";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { DbRestorePoint } from "@/lib/undo-db-change";
import { vcaasApi } from "@/lib/vcaas";
import type { DbBackup, DbBackupSchedule, DbEnv, VcaasOperation } from "@/lib/vcaas-types";

/** SP12: the platform's own download route (`/api/vcaas/backup-download/…`), streamed as an attachment. */
export const backupDownloadHref = (projectId: string, backupId: string) =>
    `/api/vcaas/backup-download/${encodeURIComponent(projectId)}/${encodeURIComponent(backupId)}`;

/** A running backup is usually written in seconds; re-read the list until it is not. */
const POLL_MS = 4000;

type Restore = { at: string; bookmark?: string; backupId?: string };

/**
 * Backups and restores of one v2 database (A10.7 (3)–(4), plan 09 §7), on the Dev/Live switch's database. PGM owns the
 * rules and every refusal; this lists, asks and says what a restore loses. A restore is itself undoable: it takes a
 * restore point first, which shows up here. A10.30: the live database of a paid plan is backed up every night; the
 * schedule, what is kept and each backup's expiry are PGM's (`schedule`), shown on the Live side only.
 */
export function BackupsPanel({ projectId, env }: { projectId: string; env: DbEnv }) {
    const t = useT();
    const price = usePrice();
    const { locale } = useLocale();
    const [data, setData] = React.useState<{ backups: DbBackup[]; points: DbRestorePoint[]; from: string; schedule: DbBackupSchedule } | null>(null);
    const [time, setTime] = React.useState("");
    const [restore, setRestore] = React.useState<Restore | null>(null);
    const [removing, setRemoving] = React.useState<DbBackup | null>(null);
    // SP13: a restore in progress, followed until the project's state no longer lists it
    const [restoring, setRestoring] = React.useState(false);

    const load = React.useCallback(async () => {
        const [backups, points] = await Promise.all([vcaasApi.v2.backups(projectId, env), vcaasApi.v2.bookmarks(projectId)]);
        if (!backups.ok || !points.ok) return toast.error(backups.error || points.error || t("engineV2.common.failed"));
        setData({ backups: backups.data.backups, points: points.data.items.filter(p => p.env === env), from: backups.data.timeTravel.availableFrom, schedule: backups.data.schedule });
    }, [projectId, env, t]);

    React.useEffect(() => {
        setData(null);
        void load();
    }, [load]);

    const running = data?.backups.some(b => b.status === "running");
    React.useEffect(() => {
        if (!running) return;
        const timer = window.setTimeout(() => void load(), POLL_MS);
        return () => window.clearTimeout(timer);
    }, [running, data, load]);

    React.useEffect(() => {
        if (!restoring) return;
        const timer = window.setInterval(() => {
            void vcaasApi.v2.state(projectId).then(response => {
                if (!response.ok || restoreRunning((response.data as { operations?: VcaasOperation[] }).operations)) return;
                setRestoring(false);
                toast.success(t("engineV2.backups.restoreDone"));
                void load();
            });
        }, POLL_MS);
        return () => window.clearInterval(timer);
    }, [restoring, projectId, t, load]);

    const done = async (response: { ok: boolean; error?: string }, success: string) => {
        if (!response.ok) return toast.error(response.error || t("engineV2.common.failed"));
        toast.success(success);
        await load();
    };


    if (!data) return <SpinnerBlock />;
    const envName = env === "dev" ? "Dev" : "Live";
    const { schedule } = data;
    const status = scheduleStatus(schedule);
    const kept = retentionParts(schedule.retention)
        .map(part => t(`engineV2.backups.${part.key}`, { n: part.n }))
        .join(", ");

    return (
        <div className="space-y-5 text-sm">
            {env === "live" ? (
                <section className="bg-muted/40 space-y-1 rounded-md border p-3" data-testid="backup-schedule">
                    <h3 className="font-medium">
                        {schedule.enabled ? t(schedule.frequency === "weekly" ? "engineV2.backups.scheduleWeekly" : "engineV2.backups.scheduleDaily", { kept }) : t("engineV2.backups.needsPlan")}
                    </h3>
                    <p className="text-muted-foreground text-xs" title={schedule.lastError}>
                        {t(`engineV2.backups.schedule_${status.key}`, { time: status.at ? formatDateTime(status.at, locale) : "" })}
                        {schedule.enabled && schedule.nextRunAt && status.key !== "first" ? ` ${t("engineV2.backups.scheduleNext", { time: formatDateTime(schedule.nextRunAt, locale) })}` : ""}
                    </p>
                    {schedule.enabled ? (
                        <p className="text-muted-foreground text-xs">
                            {schedule.frequency === "weekly" ? `${t("engineV2.backups.scheduleLarge")} ` : ""}
                            {t("engineV2.backups.scheduleStorage")}
                        </p>
                    ) : null}
                </section>
            ) : (
                <p className="text-muted-foreground text-xs">{t("engineV2.backups.scheduleDevNote")}</p>
            )}
            {restoring ? (
                <p role="status" className="bg-muted/40 flex items-center gap-2 rounded-md border p-3 text-xs">
                    <LoaderIcon className="size-3.5 animate-spin" aria-hidden />
                    {t("engineV2.backups.restoring")}
                </p>
            ) : null}
            <section className="space-y-2">
                <div className="flex items-center gap-2">
                    <h3 className="flex-1 font-medium">{t("engineV2.backups.backupsTitle", { env: envName })}</h3>
                    <Button size="sm" variant="outline" onClick={async () => done(await vcaasApi.v2.createBackup(projectId, env), t("engineV2.backups.backupStarted"))}>
                        {t("engineV2.backups.backupNow", { price: price("BACKUP_CREATE_MANUAL", "v2") })}
                    </Button>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("engineV2.backups.when")}</TableHead>
                            <TableHead>{t("engineV2.backups.kind")}</TableHead>
                            <TableHead>{t("engineV2.backups.status")}</TableHead>
                            <TableHead className="text-right">{t("engineV2.backups.size")}</TableHead>
                            <TableHead>{t("engineV2.backups.expires")}</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.backups.map(backup => (
                            <TableRow key={backup.id}>
                                <TableCell>{formatDateTime(backup.createdAt, locale)}</TableCell>
                                <TableCell>{t(`engineV2.backups.kind_${backup.kind}`)}</TableCell>
                                <TableCell title={backup.error}>{t(`engineV2.backups.status_${backup.status}`)}</TableCell>
                                <TableCell className="text-right tabular-nums">{backup.sizeBytes === null ? "—" : backupSize(backup.sizeBytes)}</TableCell>
                                <TableCell>{backup.expiresAt ? formatDateTime(backup.expiresAt, locale) : "—"}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                    {canRestoreBackup(backup) ? (
                                        <Button size="icon" variant="ghost" className="size-7" aria-label={t("engineV2.backups.restore")} title={t("engineV2.backups.restore")} onClick={() => setRestore({ at: backup.createdAt, backupId: backup.id })}>
                                            <RotateCcwIcon className="size-3.5" aria-hidden />
                                        </Button>
                                    ) : null}
                                    {backup.status === "complete" && backup.sizeBytes !== null ? (
                                        // SP12: a same-origin attachment — the tab stays on the workspace, no storage URL shown
                                        <Button size="icon" variant="ghost" className="size-7" asChild>
                                            <a href={backupDownloadHref(projectId, backup.id)} download aria-label={t("engineV2.backups.download")} title={t("engineV2.backups.download")}>
                                                <DownloadIcon className="size-3.5" aria-hidden />
                                            </a>
                                        </Button>
                                    ) : null}
                                    {backup.kind === "manual" && backup.status !== "running" ? (
                                        <Button size="icon" variant="ghost" className="size-7" aria-label={t("engineV2.backups.delete")} onClick={() => setRemoving(backup)}>
                                            <Trash2Icon className="size-3.5" aria-hidden />
                                        </Button>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {data.backups.length === 0 ? <p className="text-muted-foreground text-xs">{t("engineV2.backups.noBackups")}</p> : null}
            </section>

            <section className="space-y-2">
                <h3 className="font-medium">{t("engineV2.backups.pointsTitle")}</h3>
                <Table>
                    <TableBody>
                        {data.points.map(point => (
                            <TableRow key={point.bookmark}>
                                <TableCell>{formatDateTime(point.at, locale)}</TableCell>
                                <TableCell>{t(point.kind === "run" ? "engineV2.backups.point_run" : "engineV2.backups.point_pre_restore")}</TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" variant="outline" onClick={() => setRestore({ at: point.at, bookmark: point.bookmark })}>
                                        {t("engineV2.backups.restore")}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {data.points.length === 0 ? <p className="text-muted-foreground text-xs">{t("engineV2.backups.noPoints")}</p> : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label htmlFor="restore-time" className="text-muted-foreground text-xs">
                        {windowIsShort(data.from) ? t("engineV2.backups.toTimeSince", { time: formatDateTime(data.from, locale) }) : t("engineV2.backups.toTime")}
                    </label>
                    <Input
                        id="restore-time"
                        type="datetime-local"
                        className="h-8 w-56"
                        value={time}
                        min={data.from.slice(0, 16)}
                        onChange={e => setTime(e.target.value)}
                    />
                    <Button size="sm" variant="outline" disabled={!time} onClick={() => setRestore({ at: new Date(time).toISOString() })}>
                        {t("engineV2.backups.restoreToTime", { price: price("BACKUP_RESTORE", "v2") })}
                    </Button>
                </div>
            </section>

            <ConfirmDialog
                open={!!restore}
                onOpenChange={open => !open && setRestore(null)}
                tone="danger"
                title={t("engineV2.backups.restoreTitle", { env: envName, time: restore ? formatDateTime(restore.at, locale) : "" })}
                description={t(env === "live" ? "engineV2.backups.restoreLostLive" : "engineV2.backups.restoreLostDev", { time: restore ? formatDateTime(restore.at, locale) : "" })}
                confirmLabel={t(restore?.bookmark ? "engineV2.backups.restore" : restore?.backupId ? "engineV2.backups.restoreBackup" : "engineV2.backups.restoreToTime", {
                    price: price("BACKUP_RESTORE", "v2"),
                })}
                onConfirm={async () => {
                    if (!restore) return;
                    const response = restore.backupId
                        ? await vcaasApi.v2.restoreBackup(projectId, restore.backupId)
                        : restore.bookmark
                          ? await vcaasApi.v2.restoreDatabase(projectId, env, restore.bookmark)
                          : await vcaasApi.v2.restoreDatabaseToTime(projectId, env, restore.at);
                    await done(response, t("engineV2.backups.restoreStarted"));
                    if (response.ok) setRestoring(true);
                }}
            />
            <ConfirmDialog
                open={!!removing}
                onOpenChange={open => !open && setRemoving(null)}
                tone="danger"
                title={t("engineV2.backups.deleteTitle")}
                description={removing ? formatDateTime(removing.createdAt, locale) : ""}
                confirmLabel={t("engineV2.backups.delete")}
                onConfirm={async () => {
                    if (removing) await done(await vcaasApi.v2.deleteBackup(projectId, removing.id), t("engineV2.backups.deleted"));
                }}
            />
        </div>
    );
}
