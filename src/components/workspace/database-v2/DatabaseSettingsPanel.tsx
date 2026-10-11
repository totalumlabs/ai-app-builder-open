"use client";

import * as React from "react";
import { AlertTriangleIcon, InfoIcon, RefreshCwIcon } from "lucide-react";
import { ConfirmDialog, SpinnerBlock } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n";
import { toast } from "@/lib/toast";
import { runningDbMove } from "@/lib/db-move";
import { vcaasApi } from "@/lib/vcaas";
import type { DbEnv, DbMoveProgress, DbUsage, DbUsageEnv, DbUsageReason, VcaasOperation } from "@/lib/vcaas-types";
import { DbMoveBar } from "./DbMoveBar";

/** movprog: how often a running move's progress is re-read (one cheap state read). */
const TURSO_MOVE_POLL_MS = 5_000;

/**
 * The v2 database Settings view (Francesc 2026-09-30): usage in credits (never provider cost), statistics, the move to
 * Turso with a plain-words recommendation, and tips — all from one read, `GET …/database/usage` (totalum-accounts).
 * The move itself is the existing `database/migrate-provider`; PGM refuses what it must (plan, runs, confirmation).
 */
/** `env`: the explorer's own Dev / Live switch picks which database the figures describe. */
export function DatabaseSettingsPanel({ projectId, env }: { projectId: string; env: DbEnv }) {
    const t = useT();
    const { locale } = useLocale();
    const [data, setData] = React.useState<DbUsage | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [confirming, setConfirming] = React.useState(false);
    // movprog: the running move comes from the project's state (survives a reload), never from this view's own state
    const [move, setMove] = React.useState<DbMoveProgress | null>(null);

    const readMove = React.useCallback(async () => {
        const response = await vcaasApi.v2.state(projectId);
        const next = response.ok ? runningDbMove((response.data as { operations?: VcaasOperation[] }).operations) : null;
        setMove(next);
        return next;
    }, [projectId]);

    const load = React.useCallback(async () => {
        setError(null);
        const [response] = await Promise.all([vcaasApi.v2.databaseUsage(projectId), readMove()]);
        if (!response.ok) {
            setError(response.error || t("engineV2.common.failed"));
            return null;
        }
        setData(response.data);
        return response.data;
    }, [projectId, t, readMove]);

    React.useEffect(() => {
        void load();
    }, [load]);

    // While the move runs, follow its progress; when it ends, re-read the figures (the provider flipped, or not).
    const moving = move !== null;
    React.useEffect(() => {
        if (!moving) return;
        const timer = window.setInterval(() => {
            void readMove().then(async next => {
                if (next) return;
                // SP8: say how the move ended — the figures now name Turso, or the move did not happen
                const after = await load();
                if (after?.turso.verdict === "on_turso") toast.success(t("engineV2.dbSettings.moveDone"));
                else if (after) toast.error(t("engineV2.dbSettings.moveNotDone"));
            });
        }, TURSO_MOVE_POLL_MS);
        return () => window.clearInterval(timer);
    }, [moving, readMove, load, t]);

    if (error)
        return (
            <div className="space-y-2 p-2 text-sm">
                <p className="text-destructive">{error}</p>
                <Button size="sm" variant="outline" onClick={() => void load()}>
                    {t("common.retry")}
                </Button>
            </div>
        );
    if (!data) return <SpinnerBlock />;

    const current = data.envs.find(e => e.env === env) ?? data.envs[0];
    const n = (value: number) => new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-GB").format(value);
    const credits = (value: number) =>
        new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-GB", { maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
    // Known codes are translated; a code this build does not know yet shows the API's English words.
    const say = (reason: DbUsageReason, kind: "reason" | "tip" | "caveat") => {
        const key = `engineV2.dbSettings.${kind}_${reason.code}` as Parameters<typeof t>[0];
        const text = t(key, reason.params ?? {});
        return text === key ? reason.message : text;
    };
    const turso = data.turso;
    const minutes = Math.max(1, Math.round(turso.estimateSec / 60));
    const caveats = (turso.caveats ?? []).map(c => say(c, "caveat"));

    const startMove = async () => {
        const response = await vcaasApi.v2.migrateProvider(projectId);
        if (!response.ok) {
            toast.error(response.error || t("engineV2.common.failed"));
            return;
        }
        toast.success(t("engineV2.dbSettings.moveStarted", { minutes }));
        await readMove();
    };

    return (
        <div className="space-y-6 text-sm">
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground flex-1 text-xs">{t("engineV2.dbSettings.nightly")}</span>
                <Button size="icon" variant="ghost" className="size-7" aria-label={t("common.retry")} onClick={() => void load()}>
                    <RefreshCwIcon className="size-3.5" aria-hidden />
                </Button>
            </div>

            {current ? (
                <>
                    <section className="space-y-3" aria-labelledby="dbs-usage">
                        <h3 id="dbs-usage" className="font-medium">
                            {t("engineV2.dbSettings.usageTitle")}
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {(["today", "last7Days", "last30Days"] as const).map(p => {
                                const u = current.usage[p];
                                return (
                                    <div key={p} className="border-border rounded-lg border p-3">
                                        <p className="text-muted-foreground text-xs">{t(`engineV2.dbSettings.period_${p}`)}</p>
                                        <p className="mt-1 text-lg font-semibold tabular-nums">
                                            {t("engineV2.dbSettings.credits", { value: credits(u.credits.total) })}
                                        </p>
                                        <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                                            {t("engineV2.dbSettings.rowsLine", { read: n(u.rowsRead), written: n(u.rowsWritten) })}
                                        </p>
                                        <p className="text-muted-foreground text-xs tabular-nums">
                                            {t("engineV2.dbSettings.creditsSplit", {
                                                read: credits(u.credits.rowsRead),
                                                written: credits(u.credits.rowsWritten),
                                                storage: credits(u.credits.storage),
                                            })}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                        <DailyChart env={current} format={credits} />
                    </section>

                    <section className="space-y-3" aria-labelledby="dbs-stats">
                        <h3 id="dbs-stats" className="font-medium">
                            {t("engineV2.dbSettings.statsTitle")}
                        </h3>
                        <Stats env={current} n={n} />
                    </section>
                </>
            ) : null}

            <section className="border-border space-y-3 rounded-lg border p-4" aria-labelledby="dbs-turso">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 id="dbs-turso" className="flex-1 font-medium">
                        {t("engineV2.dbSettings.providerTitle")}
                    </h3>
                    <span className="bg-muted rounded px-2 py-0.5 text-xs font-medium">{t(`engineV2.dbSettings.verdict_${turso.verdict}`)}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                    {data.envs
                        .map(e => `${e.env === "dev" ? "Dev" : "Live"}: ${e.provider === "turso" ? "Turso" : "D1"}${e.region ? ` (${e.region})` : ""}`)
                        .join(" · ")}
                </p>
                <ul className="list-disc space-y-1 pl-5">
                    {turso.reasons.map(r => (
                        <li key={r.code}>{say(r, "reason")}</li>
                    ))}
                </ul>
                {caveats.length && turso.verdict !== "on_turso" ? (
                    <div className="text-muted-foreground space-y-1 text-xs">
                        <p className="font-medium">{t("engineV2.dbSettings.caveatsTitle")}</p>
                        <ul className="list-disc space-y-1 pl-5">
                            {caveats.map(text => (
                                <li key={text}>{text}</li>
                            ))}
                        </ul>
                    </div>
                ) : null}
                {move ? (
                    <DbMoveBar progress={move} />
                ) : turso.verdict !== "on_turso" ? (
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            size="sm"
                            variant={turso.verdict === "recommended" ? "default" : "outline"}
                            disabled={turso.paidPlanRequired}
                            onClick={() => setConfirming(true)}
                        >
                            {t("engineV2.dbSettings.moveButton", { credits: turso.credits })}
                        </Button>
                        <span className="text-muted-foreground text-xs">
                            {turso.paidPlanRequired ? t("engineV2.dbSettings.paidPlan") : t("engineV2.dbSettings.moveHint", { minutes })}
                        </span>
                    </div>
                ) : null}
            </section>

            <section className="space-y-2" aria-labelledby="dbs-tips">
                <h3 id="dbs-tips" className="font-medium">
                    {t("engineV2.dbSettings.tipsTitle")}
                </h3>
                {data.tips.length === 0 ? (
                    <p className="text-muted-foreground">{t("engineV2.dbSettings.noTips")}</p>
                ) : (
                    <ul className="space-y-2">
                        {data.tips.map((tip, i) => (
                            <li key={`${tip.code}-${i}`} className="border-border flex gap-2 rounded-lg border p-3">
                                {tip.severity === "warn" ? (
                                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label={t("engineV2.dbSettings.warn")} />
                                ) : (
                                    <InfoIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-label={t("engineV2.dbSettings.info")} />
                                )}
                                <div className="min-w-0 space-y-1">
                                    <p>
                                        <span className="text-muted-foreground mr-1 text-xs">{tip.env === "dev" ? "Dev" : "Live"} ·</span>
                                        {say(tip, "tip")}
                                    </p>
                                    {tip.params?.sql ? <p className="text-muted-foreground truncate font-mono text-xs">{tip.params.sql}</p> : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                tone="danger"
                title={t("engineV2.dbSettings.confirmTitle")}
                description={[t("engineV2.dbSettings.confirmBody", { minutes, credits: turso.credits }), ...caveats].join(" ")}
                confirmLabel={t("engineV2.dbSettings.confirmButton")}
                confirmPhrase={projectId}
                onConfirm={startMove}
            />
        </div>
    );
}

function Stats({ env, n }: { env: DbUsageEnv; n: (v: number) => string }) {
    const t = useT();
    const mb = (b: number | null) => (b === null ? "—" : b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(b < 1e7 ? 2 : 1)} MB`);
    const sized = env.daily.filter(d => d.sizeBytes !== null);
    const growth = sized.length >= 2 ? (sized[sized.length - 1].sizeBytes ?? 0) - (sized[0].sizeBytes ?? 0) : null;
    const requests = env.daily.reduce((s, d) => s + d.requests, 0);
    const top = (env.tables?.list ?? []).filter(x => (x.rows ?? 0) > 0).slice(0, 5);
    const maxRows = Math.max(1, ...top.map(x => x.rows ?? 0));
    const tiles: [string, string][] = [
        [t("engineV2.dbSettings.size"), mb(env.sizeBytes)],
        [t("engineV2.dbSettings.growth"), growth === null ? "—" : `${growth >= 0 ? "+" : "−"}${mb(Math.abs(growth))}`],
        [t("engineV2.dbSettings.tables"), env.tables ? n(env.tables.count) : "—"],
        [t("engineV2.dbSettings.rows"), env.tables?.rows == null ? "—" : n(env.tables.rows)],
        [t("engineV2.dbSettings.requestsPerDay"), env.daily.length ? n(Math.round(requests / env.daily.length)) : "—"],
    ];
    return (
        <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {tiles.map(([label, value]) => (
                    <div key={label} className="border-border rounded-lg border p-3">
                        <dt className="text-muted-foreground text-xs">{label}</dt>
                        <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
                    </div>
                ))}
            </dl>
            {top.length ? (
                <div className="space-y-1.5">
                    <p className="text-muted-foreground text-xs">{t("engineV2.dbSettings.biggestTables")}</p>
                    {top.map(row => (
                        <div key={row.name} className="flex items-center gap-2 text-xs">
                            <span className="w-32 shrink-0 truncate font-mono">{row.name}</span>
                            <div className="bg-muted h-2 flex-1 rounded">
                                <div className="h-2 rounded" style={{ width: `${((row.rows ?? 0) / maxRows) * 100}%`, background: "var(--data-1)" }} />
                            </div>
                            <span className="w-20 shrink-0 text-right tabular-nums">{row.rows === null ? "—" : row.estimated ? t("engineV2.dbSettings.estimatedRows", { rows: n(row.rows) }) : n(row.rows)}</span>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs">{t("engineV2.dbSettings.slowQueries")}</p>
                {env.queries === null ? (
                    <p className="text-muted-foreground text-xs">{t("engineV2.dbSettings.noQueryStats")}</p>
                ) : env.queries.length === 0 ? (
                    <p className="text-muted-foreground text-xs">{t("engineV2.dbSettings.noQueries")}</p>
                ) : (
                    <table className="w-full text-xs">
                        <thead className="text-muted-foreground text-left">
                            <tr>
                                <th className="py-1 font-normal">{t("engineV2.dbSettings.query")}</th>
                                <th className="py-1 text-right font-normal">{t("engineV2.dbSettings.calls")}</th>
                                <th className="py-1 text-right font-normal">{t("engineV2.dbSettings.avgMs")}</th>
                                <th className="py-1 text-right font-normal">{t("engineV2.dbSettings.rowsRead")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {env.queries.slice(0, 5).map(q => (
                                <tr key={q.sql} className="border-border border-t">
                                    <td className="max-w-0 truncate py-1 pr-2 font-mono" title={q.sql}>
                                        {q.sql}
                                    </td>
                                    <td className="py-1 text-right tabular-nums">{n(q.count)}</td>
                                    <td className="py-1 text-right tabular-nums">{n(Math.round(q.totalMs / Math.max(1, q.count)))}</td>
                                    <td className="py-1 text-right tabular-nums">{n(q.rowsRead)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

const SERIES = [
    { key: "rowsRead", color: "var(--data-1)" },
    { key: "rowsWritten", color: "var(--data-2)" },
    { key: "storage", color: "var(--data-4)" },
] as const;

/** 30 days of database credits, stacked by reads / writes / storage; hover a day for its figures. */
function DailyChart({ env, format }: { env: DbUsageEnv; format: (v: number) => string }) {
    const t = useT();
    const [hover, setHover] = React.useState<number | null>(null);
    const days = React.useMemo(() => {
        const byDate = new Map(env.daily.map(d => [d.date, d]));
        return Array.from({ length: 30 }, (_, i) => {
            const date = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10);
            const d = byDate.get(date);
            return { date, rowsRead: d?.credits.rowsRead ?? 0, rowsWritten: d?.credits.rowsWritten ?? 0, storage: d?.credits.storage ?? 0, rows: d };
        });
    }, [env.daily]);
    const max = Math.max(...days.map(d => d.rowsRead + d.rowsWritten + d.storage), 0);
    const H = 120;
    const w = 100 / days.length;
    const shown = hover === null ? null : days[hover];
    return (
        <div className="border-border rounded-lg border p-3">
            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
                <span className="text-muted-foreground flex-1">{t("engineV2.dbSettings.chartTitle")}</span>
                {SERIES.map(s => (
                    <span key={s.key} className="flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                        {t(`engineV2.dbSettings.series_${s.key}`)}
                    </span>
                ))}
            </div>
            {max === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-xs">{t("engineV2.dbSettings.noUsage")}</p>
            ) : (
                <div className="relative">
                    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ height: H }} className="w-full" role="presentation">
                        {days.map((d, i) => {
                            let y = H;
                            return (
                                <g key={d.date} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(c => (c === i ? null : c))}>
                                    <rect x={i * w} y={0} width={w} height={H} fill="transparent" />
                                    {SERIES.map(s => {
                                        const h = (d[s.key] / max) * (H - 4);
                                        if (h <= 0) return null;
                                        y -= h;
                                        return <rect key={s.key} x={i * w + w * 0.15} y={y} width={w * 0.7} height={Math.max(0.5, h - 0.5)} fill={s.color} />;
                                    })}
                                </g>
                            );
                        })}
                    </svg>
                    <div className="text-muted-foreground mt-1 flex justify-between text-2xs">
                        <span>{days[0].date.slice(5)}</span>
                        <span>{days[days.length - 1].date.slice(5)}</span>
                    </div>
                    {shown ? (
                        <div className="bg-popover text-popover-foreground pointer-events-none absolute top-0 right-0 rounded-lg border px-3 py-2 text-xs shadow-md">
                            <p className="font-medium">{shown.date}</p>
                            {SERIES.map(s => (
                                <p key={s.key} className="flex gap-3">
                                    <span className="text-muted-foreground">{t(`engineV2.dbSettings.series_${s.key}`)}</span>
                                    <span className="ml-auto tabular-nums">{t("engineV2.dbSettings.credits", { value: format(shown[s.key]) })}</span>
                                </p>
                            ))}
                            {shown.rows ? (
                                <p className="text-muted-foreground mt-1 tabular-nums">
                                    {t("engineV2.dbSettings.rowsLine", { read: String(shown.rows.rowsRead), written: String(shown.rows.rowsWritten) })}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            )}
            <table className="sr-only">
                <caption>{t("engineV2.dbSettings.chartTitle")}</caption>
                <tbody>
                    {days.map(d => (
                        <tr key={d.date}>
                            <th scope="row">{d.date}</th>
                            <td>{format(d.rowsRead + d.rowsWritten + d.storage)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
