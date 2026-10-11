"use client";

import * as React from "react";
import { useT } from "@/i18n";
import { dbMovePercent, formatBytes } from "@/lib/db-move";
import type { DbMoveProgress } from "@/lib/vcaas-types";

/** movprog: the running move to Turso — which database, the %, the phase and about how long is left. */
export function DbMoveBar({ progress }: { progress: DbMoveProgress }) {
    const t = useT();
    const pct = dbMovePercent(progress);
    const minutes = Math.max(1, Math.round(progress.etaSec / 60));
    const title = t("engineV2.dbSettings.moveProgressTitle", { env: t(`engineV2.dbSettings.moveEnv_${progress.env}`) });
    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                <span className="min-w-0 flex-1 font-medium">{title}</span>
                <span className="tabular-nums">
                    {pct}% · {t("engineV2.dbSettings.moveMinutesLeft", { minutes })}
                </span>
            </div>
            <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="bg-muted h-2 overflow-hidden rounded-full">
                <div className="bg-primary h-2 rounded-full transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-muted-foreground text-xs tabular-nums">
                {progress.phase === "copying" && progress.totalBytes > 0
                    ? t("engineV2.dbSettings.movePhase_copying", { copied: formatBytes(progress.copiedBytes), total: formatBytes(progress.totalBytes) })
                    : t(`engineV2.dbSettings.movePhase_${progress.phase === "copying" ? "starting" : progress.phase}`)}
            </p>
        </div>
    );
}
