"use client";

import * as React from "react";
import { AlertTriangleIcon, DatabaseIcon, LoaderIcon, PauseCircleIcon, WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n";
import { usePrice } from "@/components/credits/CreditsProvider";
import { runningDbMove } from "@/lib/db-move";
import { formatDateTime } from "@/lib/format";
import { isPausedByUser, isV2Project } from "@/lib/project-status";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { VcaasProject } from "@/lib/vcaas-types";
import { DbMoveBar } from "../database-v2/DbMoveBar";
import { ConfirmDestructive, destructiveStatement, fixPrompt, isDevDestructive, isInfraError } from "./DeployErrorCard";
import { RunawayNotice } from "./RunawayNotice";

/**
 * The v2 banner slot of the workspace (plan 15 §1.4 precedence): the emergency stop's pause (runrel) wins over the
 * user's own pause
 * (A4.13) wins over a running move to Turso (movprog), which wins over "Last publish failed at <stage>" (A5.14). A
 * legacy project renders nothing.
 */
export function V2Banner({
    project,
    onChanged,
    onAskFix,
    onPublishConfirmed,
    viewOnly,
}: {
    project: VcaasProject | null;
    /** A member who may only look: no "Bring it back online". */
    viewOnly?: boolean;
    onChanged: () => void;
    onAskFix: (prompt: string) => void;
    /** Publishes again with `confirmDestructive: true` (only offered for an unconfirmed destructive migration). */
    onPublishConfirmed?: () => void;
}) {
    const t = useT();
    const price = usePrice();
    const { locale } = useLocale();
    const [resuming, setResuming] = React.useState(false);

    if (!project || !isV2Project(project)) return null;

    if (project.runawayPause)
        return <RunawayNotice project={project} pause={project.runawayPause} viewOnly={viewOnly} onChanged={onChanged} onAskFix={onAskFix} />;

    if (isPausedByUser(project)) {
        const resumable = (project.lifecycle?.resumable ?? project.resumable) !== false;
        const pausedAt = project.lifecycle?.pausedAt ?? project.pausedAt;
        // The resume runs as an engine operation: while it runs the button waits, and a failed one says so — only the
        // latest resume started since this pause counts (an older failed one is superseded).
        const resumeOp = project.operations
            ?.filter(op => op.kind === "resume" && (!pausedAt || op.startedAt > pausedAt))
            .reduce<NonNullable<VcaasProject["operations"]>[number] | undefined>((latest, op) => (!latest || op.startedAt > latest.startedAt ? op : latest), undefined);
        const busy = resuming || resumeOp?.status === "running";
        const resume = async () => {
            setResuming(true);
            const response = await vcaasApi.v2.resume(project.projectId);
            setResuming(false);
            // PROJECT_NOT_PAUSED is the idempotent no-op: treated as success (plan 15 §4.23).
            if (response.ok || response.upstreamCode === "PROJECT_NOT_PAUSED") toast.success(t("engineV2.pause.resumeStarted"));
            else toast.error(response.error || t("engineV2.pause.resumeFailed"));
            onChanged();
        };
        return (
            <div role="status" className="border-warning/40 bg-warning-subtle text-warning-subtle-foreground flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm">
                <PauseCircleIcon className="size-4 shrink-0" aria-hidden />
                <p className="min-w-0 flex-1">
                    <span className="font-medium">{t("engineV2.pause.bannerTitle")}</span>{" "}
                    {t("engineV2.pause.bannerBody", { date: pausedAt ? formatDateTime(pausedAt, locale) : "—", price: price("PAUSE_RESUME", "v2") })}
                </p>
                {resumable ? (
                    <Button size="sm" onClick={() => void resume()} disabled={busy}>
                        {busy ? <LoaderIcon className="size-3.5 animate-spin" aria-hidden /> : null}
                        {t("engineV2.pause.resume")}
                    </Button>
                ) : (
                    <span className="text-xs">{t("engineV2.pause.preparing")}</span>
                )}
                {resumeOp?.status === "error" ? <p className="text-destructive w-full text-xs">{t("engineV2.pause.resumeFailed")}</p> : null}
            </div>
        );
    }

    // movprog: read from the engine's state, so it is there after a reload; the workspace re-reads it every 5 s
    const move = runningDbMove(project.operations);
    if (move)
        return (
            <div role="status" className="border-info/30 bg-info-subtle text-info-subtle-foreground flex items-start gap-3 border-b px-4 py-2.5 text-sm">
                <DatabaseIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                    <p>{t("engineV2.dbSettings.moveBanner")}</p>
                    <div className="max-w-xl">
                        <DbMoveBar progress={move} />
                    </div>
                </div>
            </div>
        );

    const error = project.lastDeployError;
    if (!error) return null;
    const statement = destructiveStatement(error);
    return (
        <div role="alert" className="border-destructive/40 bg-destructive-subtle text-destructive-subtle-foreground flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm">
            <AlertTriangleIcon className="size-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1 truncate">
                <span className="font-medium">{t("engineV2.deployError.banner", { stage: error.stage })}</span> {error.title}
            </p>
            {isInfraError(error) ? (
                <p className="w-full text-xs">{t("engineV2.deployError.infra")}</p>
            ) : (
                <Button size="sm" variant="outline" onClick={() => onAskFix(fixPrompt(t, error))}>
                    <WandSparklesIcon className="size-3.5" aria-hidden />
                    {t("engineV2.deployError.askFix")}
                </Button>
            )}
            {/* research 63 P-63.3: why the repair run could not fix it and what the user must do */}
            {error.fixSummary ? (
                <p className="line-clamp-3 w-full text-xs whitespace-pre-wrap">
                    {t("engineV2.deployError.fixSummary")} {error.fixSummary}
                </p>
            ) : null}
            {isDevDestructive(error) ? <p className="w-full text-xs">{t("engineV2.deployError.devDestructive")}</p> : null}
            {statement !== null && onPublishConfirmed ? (
                <ConfirmDestructive statement={statement} onConfirm={onPublishConfirmed} />
            ) : null}
        </div>
    );
}
