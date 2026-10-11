import type { DbBackup, DbBackupSchedule } from "./vcaas-types";

/**
 * A10.30, scheduled database backups: what the Backups tab says about a schedule the platform does not run (PGM does).
 * Pure: i18n keys and values, the panel formats the dates.
 */

/** The tiers the plan keeps, in order; a tier of 0 (no months on Starter) is left out. */
export function retentionParts(r: DbBackupSchedule["retention"]): { key: "keptDays" | "keptWeeks" | "keptMonths"; n: number }[] {
    if (!r) return [];
    return ([["keptDays", r.daily], ["keptWeeks", r.weekly], ["keptMonths", r.monthly]] as const).filter(([, n]) => n > 0).map(([key, n]) => ({ key, n }));
}

/**
 * The one line under the schedule. `unchangedSince`: last night copied nothing because nothing was written since the
 * last backup, which is therefore still the current state (`at` is that backup's time, not the run's).
 */
export function scheduleStatus(s: DbBackupSchedule): { key: "needsPlan" | "first" | "lastComplete" | "unchangedSince" | "lastFailed"; at: string | null } {
    if (!s.enabled) return { key: "needsPlan", at: null };
    if (s.lastStatus === "failed") return { key: "lastFailed", at: s.lastBackupAt };
    if (s.lastStatus === "skipped_unchanged") return { key: "unchangedSince", at: s.lastBackupAt };
    if (s.lastStatus === "complete") return { key: "lastComplete", at: s.lastBackupAt };
    return { key: "first", at: s.nextRunAt };
}

/** A backup whose dump can be put back (`POST …/backups/:id/restore`): complete, with a file. */
export const canRestoreBackup = (b: DbBackup) => b.status === "complete" && b.sizeBytes !== null;

export function backupSize(bytes: number): string {
    if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** SP13: a database restore still running (the project's state lists it until it ends, however it ends). */
export const restoreRunning = (operations: { kind: string; status: string }[] | undefined) =>
    !!operations?.some(o => o.kind === "backupRestore" && o.status === "running");

/** SP8: the restore window is shorter than the usual 30 days (a database on Turso: its history starts at the move). */
export const windowIsShort = (availableFrom: string, now = Date.now()) => Date.parse(availableFrom) > now - 29 * 86_400_000;
