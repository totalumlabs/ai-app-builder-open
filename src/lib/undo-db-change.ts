import type { DbEnv } from "./vcaas-types";

/** `GET …/database/bookmarks?runId=` item (contracts `DbRestorePoint`), newest first. */
export interface DbRestorePoint {
    env: DbEnv;
    bookmark: string;
    at: string;
    kind: "run" | "pre_restore";
    runId?: string;
}

/**
 * Research 50 P-50.1: "Undo the last AI database change" is offered for the latest run when it changed the database.
 * The undo goes back to the run's FIRST point — the oldest of its `run` points in a newest-first list — and everything
 * written since that moment is lost (a backup is kept).
 *
 * A point alone does not prove a change: PGM takes a dev point at the start of every run (A10.7 (3)), a live one only
 * before the run's first live write. So the run changed the database when it has a live point, or when the dev
 * ledger's newest migration (`createdAt` = when drizzle-kit generated it) is not older than the run's start.
 */
export function undoTarget(runId: string | undefined, points: DbRestorePoint[], devLedgerLastCreatedAt?: number | null): DbRestorePoint | null {
    if (!runId) return null;
    const own = points.filter((p) => p.kind === "run" && p.runId === runId);
    if (!own.length) return null;
    const first = own[own.length - 1];
    const changed = own.some((p) => p.env === "live") || (devLedgerLastCreatedAt ?? -Infinity) >= Date.parse(first.at);
    return changed ? first : null;
}
