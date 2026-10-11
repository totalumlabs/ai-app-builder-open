import type { DbMoveProgress, VcaasOperation } from "./vcaas-types";

/**
 * movprog: the running D1 → Turso move, read from the engine's project state (never from local state, so it survives a
 * reload). `null` when no move runs. A move that has not reported yet (its first seconds) counts as copying 0 bytes.
 */
export function runningDbMove(operations: VcaasOperation[] | undefined): DbMoveProgress | null {
    const op = operations?.find(o => o.kind === "dbProviderMigration" && o.status === "running");
    if (!op) return null;
    const p = op.progress as Partial<DbMoveProgress> | undefined;
    if (p?.phase && p.env) return p as DbMoveProgress;
    return { phase: "copying", env: "live", copiedBytes: 0, totalBytes: 0, etaSec: 0 };
}

/** The bar's %: the bytes copied while copying (never 100 before it ends), then 100 while checking and switching. */
export function dbMovePercent(p: DbMoveProgress): number {
    if (p.phase !== "copying") return 100;
    return p.totalBytes > 0 ? Math.min(99, Math.floor((p.copiedBytes / p.totalBytes) * 100)) : 0;
}

export const formatBytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB`);
