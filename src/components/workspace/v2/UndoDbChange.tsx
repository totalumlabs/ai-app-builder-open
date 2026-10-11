"use client";

import * as React from "react";
import { Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { undoTarget, type DbRestorePoint } from "@/lib/undo-db-change";
import { vcaasApi } from "@/lib/vcaas";

/**
 * "Undo the last AI database change" (research 50 P-50.1), in the database section's Migrations view (Francesc
 * 2026-09-30: not in the chat). Shown only when the latest finished run changed the database (`undoTarget`); the
 * confirm step names what is lost. Free. While a run is in flight the status is not `done`, so nothing is offered.
 */
export function UndoDbChange({ projectId, agentBusy = false }: { projectId: string; agentBusy?: boolean }) {
    const t = useT();
    const { locale } = useLocale();
    const [target, setTarget] = React.useState<{ runId: string; point: DbRestorePoint } | null>(null);
    const [step, setStep] = React.useState<"idle" | "confirm" | "sending" | "done">("idle");

    React.useEffect(() => {
        if (agentBusy) return;
        let live = true;
        void (async () => {
            const status = await vcaasApi.agent.status(projectId);
            const runId = status.ok && status.data?.status === "done" ? status.data.runId : undefined;
            const [points, dev] = runId ? await Promise.all([vcaasApi.v2.bookmarks(projectId, runId), vcaasApi.v2.schema(projectId, "dev")]) : [null, null];
            const point = runId && points?.ok ? undoTarget(runId, points.data?.items ?? [], dev?.ok ? dev.data?.ledger?.lastCreatedAt : null) : null;
            if (live) setTarget(runId && point ? { runId, point } : null);
        })();
        return () => {
            live = false;
        };
    }, [projectId, agentBusy]);

    if (!target || agentBusy || step === "done") return null;

    const undo = async () => {
        setStep("sending");
        const response = await vcaasApi.v2.undoRun(projectId, target.runId);
        if (response.ok) {
            toast.success(t("engineV2.undoDb.started"));
            setStep("done");
        } else {
            toast.error(response.error || t("engineV2.common.failed"));
            setStep("idle");
        }
    };

    if (step === "idle")
        return (
            <div data-testid="undo-db-change" className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <p className="text-muted-foreground min-w-0 flex-1 text-xs">{t("engineV2.undoDb.hint")}</p>
                <Button size="sm" variant="outline" onClick={() => setStep("confirm")}>
                    <Undo2Icon className="size-3.5" aria-hidden />
                    {t("engineV2.undoDb.button")}
                </Button>
            </div>
        );
    return (
        <div role="alertdialog" className="border-warning/40 bg-warning-subtle text-warning-subtle-foreground space-y-2 rounded-lg border p-3 text-sm">
            {/* A dev+live project's undo restores the dev database: the preview's data, never the live site's */}
            <p>{t(target.point.env === "dev" ? "engineV2.undoDb.warningDev" : "engineV2.undoDb.warning", { time: formatDateTime(target.point.at, locale) })}</p>
            <div className="flex gap-2">
                <Button size="sm" variant="destructive" disabled={step === "sending"} onClick={undo}>
                    {t("engineV2.undoDb.confirm")}
                </Button>
                <Button size="sm" variant="outline" disabled={step === "sending"} onClick={() => setStep("idle")}>
                    {t("engineV2.undoDb.cancel")}
                </Button>
            </div>
        </div>
    );
}
