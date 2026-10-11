"use client";

import * as React from "react";
import { LoaderIcon, ShieldAlertIcon, WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/types";
import { formatDateTimeZoned } from "@/lib/format";
import { toast } from "@/lib/toast";
import { vcaasApi } from "@/lib/vcaas";
import type { VcaasProject } from "@/lib/vcaas-types";

const METRICS = new Set(["credits_hour", "usd_hour", "rows_written_5min", "rows_read_5min", "requests_5min"]);

/**
 * runrel: the emergency stop paused this project's site (SDK-API's runaway breakers). What it measured, when it comes
 * back by itself, fix the cause first, and — for whoever may edit the project — "Bring it back online", confirmed
 * inline. The e-mail's button lands here with `?runaway=resume`, which opens that confirmation.
 */
export function RunawayNotice({
    project,
    pause,
    viewOnly,
    onChanged,
    onAskFix,
}: {
    project: VcaasProject;
    pause: NonNullable<VcaasProject["runawayPause"]>;
    viewOnly?: boolean;
    onChanged: () => void;
    onAskFix: (prompt: string) => void;
}) {
    const t = useT();
    const { locale } = useLocale();
    const [confirming, setConfirming] = React.useState(
        () => !viewOnly && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("runaway") === "resume",
    );
    const [busy, setBusy] = React.useState(false);
    const n = (v?: number) => (v ?? 0).toLocaleString(locale, { maximumFractionDigits: 1 });
    const what = t(`engineV2.runaway.${METRICS.has(pause.metric) ? pause.metric : "other"}` as TranslationKey, {
        value: n(pause.value),
        limit: n(pause.threshold),
    });
    const release = async () => {
        setBusy(true);
        const response = await vcaasApi.v2.releaseRunaway(project.projectId);
        setBusy(false);
        setConfirming(false);
        if (!response.ok) toast.error(response.error || t("engineV2.runaway.failed"));
        else toast.success(t(response.data?.released ? "engineV2.runaway.released" : "engineV2.runaway.notPaused"));
        onChanged();
    };
    return (
        <div role="alert" className="border-destructive/40 bg-destructive-subtle text-destructive-subtle-foreground flex flex-wrap items-start gap-3 border-b px-4 py-2.5 text-sm">
            <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
                <p>
                    <span className="font-medium">{t("engineV2.runaway.title")}</span> {what}
                </p>
                <p>{t("engineV2.runaway.paused", { date: formatDateTimeZoned(pause.resumesAt, locale) })}</p>
                <p className="font-medium">{t("engineV2.runaway.fix")}</p>
                {confirming ? <p>{t("engineV2.runaway.confirm")}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
                {viewOnly ? null : (
                    <Button size="sm" variant="outline" onClick={() => onAskFix(t("engineV2.runaway.fixPrompt", { what }))}>
                        <WandSparklesIcon className="size-3.5" aria-hidden />
                        {t("engineV2.runaway.askFix")}
                    </Button>
                )}
                {viewOnly ? null : confirming ? (
                    <>
                        <Button size="sm" onClick={() => void release()} disabled={busy}>
                            {busy ? <LoaderIcon className="size-3.5 animate-spin" aria-hidden /> : null}
                            {t("engineV2.runaway.bringBack")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                            {t("engineV2.runaway.cancel")}
                        </Button>
                    </>
                ) : (
                    <Button size="sm" onClick={() => setConfirming(true)}>
                        {t("engineV2.runaway.bringBack")}
                    </Button>
                )}
            </div>
        </div>
    );
}
