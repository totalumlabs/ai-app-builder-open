"use client";

import * as React from "react";
import { ChartColumnIcon, GlobeIcon, LinkIcon, MonitorSmartphoneIcon, RefreshCwIcon, RocketIcon } from "lucide-react";
import { EmptyState, Modal, SpinnerBlock } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale, useT } from "@/i18n";
import {
    analyticsQuery,
    countryName,
    fillSeries,
    flagOf,
    pageRows,
    rangeOf,
    referrerRows,
    RETENTION_DAYS,
    totalsOf,
    type RangePreset,
    type SiteAnalyticsAnswer,
    type SiteAnalyticsDimension,
    type SiteAnalyticsGranularity,
    type SiteAnalyticsRow,
} from "@/lib/site-analytics";
import { vcaasApi } from "@/lib/vcaas";
import { Callout, Card, Segmented } from "./page-bits";

type Lists = Record<"device" | "path" | "referrer" | "country" | "browser", SiteAnalyticsRow[]>;
interface Loaded {
    series: SiteAnalyticsAnswer;
    lists: Lists;
}
const DIMENSIONS = ["device", "path", "referrer", "country", "browser"] as const satisfies readonly SiteAnalyticsDimension[];
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * "Analytics" of a v2 project (A6.16): visits and page views of the published site and its domains (never the preview),
 * counted by Totalum's front door from its own request log — no script in the site, no cookie, bots left out. A visit
 * is one visitor on one day; the hourly chart counts it in the hour it starts. Free to view.
 * Six reads of `GET …/analytics/site` per load (the server caches each for a minute).
 */
export function SiteAnalyticsModal({
    open,
    onOpenChange,
    projectId,
    published,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    published: boolean;
}) {
    const t = useT();
    const [preset, setPreset] = React.useState<RangePreset>("7d");
    const [custom, setCustom] = React.useState(() => ({ from: isoDay(Date.now() - 6 * 86_400_000), to: isoDay(Date.now()) }));
    const [data, setData] = React.useState<Loaded | "error" | undefined>(undefined);
    const [reload, setReload] = React.useState(0);
    const waitingForPublish = !published;

    React.useEffect(() => {
        if (!open || waitingForPublish) return;
        const range = rangeOf(preset, Date.now(), custom);
        if (!range) return;
        let live = true;
        setData(undefined);
        void Promise.all([
            vcaasApi.v2.siteAnalytics(projectId, analyticsQuery(range)),
            ...DIMENSIONS.map(dimension => vcaasApi.v2.siteAnalytics(projectId, analyticsQuery(range, dimension))),
        ]).then(([series, ...tops]) => {
            if (!live) return;
            if (!series.ok || tops.some(top => !top.ok)) return setData("error");
            setData({
                series: series.data,
                lists: Object.fromEntries(DIMENSIONS.map((dimension, i) => [dimension, (tops[i].ok && tops[i].data.top) || []])) as Lists,
            });
        });
        return () => {
            live = false;
        };
    }, [open, projectId, preset, custom, waitingForPublish, reload]);

    const totals = data && data !== "error" ? totalsOf(data.lists.device) : null;
    const today = isoDay(Date.now());
    const oldest = isoDay(Date.now() - (RETENTION_DAYS - 1) * 86_400_000);

    return (
        <Modal open={open} onOpenChange={onOpenChange} size="xl" title={t("engineV2.analytics.title")} description={t("engineV2.analytics.intro")}>
            <div className="space-y-5" data-testid="site-analytics">
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Segmented<RangePreset>
                        label={t("engineV2.analytics.rangeLabel")}
                        value={preset}
                        onChange={setPreset}
                        options={(["24h", "7d", "30d", "custom"] as const).map(value => ({ value, label: t(`engineV2.analytics.range_${value}`) }))}
                    />
                </div>
                {preset === "custom" ? (
                    <div className="flex flex-wrap items-end gap-3 text-xs">
                        {(["from", "to"] as const).map(side => (
                            <label key={side} className="flex flex-col gap-1">
                                <span className="text-muted-foreground">{t(`engineV2.analytics.${side}`)}</span>
                                <Input
                                    type="date"
                                    className="h-8 w-40"
                                    min={side === "to" ? custom.from : oldest}
                                    max={side === "from" ? custom.to : today}
                                    value={custom[side]}
                                    onChange={event => event.target.value && setCustom(current => ({ ...current, [side]: event.target.value }))}
                                />
                            </label>
                        ))}
                        <span className="text-muted-foreground pb-2">{t("engineV2.analytics.customHint", { days: RETENTION_DAYS })}</span>
                    </div>
                ) : null}

                {waitingForPublish ? (
                    <EmptyState
                        icon={<RocketIcon />}
                        title={t("engineV2.analytics.notPublishedTitle")}
                        description={t("engineV2.analytics.notPublishedBody")}
                    />
                ) : data === undefined ? (
                    <SpinnerBlock />
                ) : data === "error" ? (
                    <Callout tone="warning" title={t("engineV2.analytics.unavailable")}>
                        <Button size="sm" variant="outline" className="mt-1" onClick={() => setReload(n => n + 1)}>
                            <RefreshCwIcon aria-hidden /> {t("engineV2.analytics.retry")}
                        </Button>
                    </Callout>
                ) : (
                    <>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Stat testId="stat-visits" label={t("engineV2.analytics.visits")} value={totals!.visits} hint={t("engineV2.analytics.visitsHint")} />
                            <Stat testId="stat-pageviews" label={t("engineV2.analytics.pageViews")} value={totals!.pageViews} hint={t("engineV2.analytics.pageViewsHint")} />
                            <Stat
                                testId="stat-pages-per-visit"
                                label={t("engineV2.analytics.pagesPerVisit")}
                                value={totals!.pagesPerVisit}
                                digits={1}
                                hint={t("engineV2.analytics.pagesPerVisitHint")}
                            />
                        </div>
                        {totals!.pageViews === 0 && totals!.visits === 0 ? (
                            <Callout title={t("engineV2.analytics.noVisitsTitle")}>{t("engineV2.analytics.noVisitsLive")}</Callout>
                        ) : null}
                        <VisitsChart answer={data.series} />
                        <div className="grid gap-3 md:grid-cols-2">
                            <TopList
                                testId="top-pages"
                                icon={<ChartColumnIcon />}
                                title={t("engineV2.analytics.topPages")}
                                column={t("engineV2.analytics.pageViews")}
                                metric="page_views"
                                rows={pageRows(data.lists.path)}
                                label={row => <span className="font-mono text-xs">{row.key || "/"}</span>}
                            />
                            <TopList
                                testId="top-referrers"
                                icon={<LinkIcon />}
                                title={t("engineV2.analytics.referrers")}
                                description={t("engineV2.analytics.referrersHint")}
                                column={t("engineV2.analytics.visits")}
                                metric="uniques"
                                rows={referrerRows(data.lists.referrer, totals!.visits)}
                                label={row => row.key || t("engineV2.analytics.direct")}
                            />
                            <TopList
                                testId="top-countries"
                                icon={<GlobeIcon />}
                                title={t("engineV2.analytics.countries")}
                                column={t("engineV2.analytics.visits")}
                                metric="uniques"
                                rows={data.lists.country}
                                label={row => <CountryLabel code={row.key} unknown={t("engineV2.analytics.unknown")} />}
                            />
                            <TopList
                                testId="top-devices"
                                icon={<MonitorSmartphoneIcon />}
                                title={t("engineV2.analytics.devices")}
                                column={t("engineV2.analytics.visits")}
                                metric="uniques"
                                rows={data.lists.device}
                                label={row => deviceLabel(t, row.key)}
                                extra={
                                    data.lists.browser.length ? (
                                        <p className="text-muted-foreground text-xs">
                                            {t("engineV2.analytics.browsers")}:{" "}
                                            {data.lists.browser
                                                .slice(0, 5)
                                                .map(row => `${browserName(row.key, t)} ${Math.round(row.share * 100)}%`)
                                                .join(" · ")}
                                        </p>
                                    ) : null
                                }
                            />
                        </div>
                    </>
                )}
                <p className="text-muted-foreground text-xs leading-relaxed" data-testid="analytics-fineprint">
                    {t("engineV2.analytics.fineprint", { days: RETENTION_DAYS })}
                </p>
            </div>
        </Modal>
    );
}

function Stat({ label, value, hint, digits = 0, testId }: { label: string; value: number | null; hint: string; digits?: number; testId: string }) {
    const { locale } = useLocale();
    return (
        <Card testId={testId} className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
            <p className="font-display text-3xl font-semibold tabular-nums">
                {value === null ? "—" : value.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
        </Card>
    );
}

function CountryLabel({ code, unknown }: { code: string; unknown: string }) {
    const { locale } = useLocale();
    if (!code || code === "XX" || code === "T1") return <>{unknown}</>;
    return (
        <>
            <span aria-hidden>{flagOf(code)}</span> {countryName(code, locale)}
        </>
    );
}

const DEVICES = ["desktop", "mobile", "tablet"] as const;
function deviceLabel(t: ReturnType<typeof useT>, key: string): string {
    return (DEVICES as readonly string[]).includes(key) ? t(`engineV2.analytics.device_${key as (typeof DEVICES)[number]}`) : t("engineV2.analytics.unknown");
}
const BROWSERS: Record<string, string> = { chrome: "Chrome", safari: "Safari", firefox: "Firefox", edge: "Edge", opera: "Opera" };
const browserName = (key: string, t: ReturnType<typeof useT>) => BROWSERS[key] ?? t("engineV2.analytics.other");

function TopList({
    title,
    description,
    icon,
    column,
    metric,
    rows,
    label,
    extra,
    testId,
}: {
    title: string;
    description?: string;
    icon: React.ReactNode;
    column: string;
    metric: "page_views" | "uniques";
    rows: SiteAnalyticsRow[];
    label: (row: SiteAnalyticsRow) => React.ReactNode;
    extra?: React.ReactNode;
    testId: string;
}) {
    const t = useT();
    const { locale } = useLocale();
    return (
        <Card title={title} description={description} icon={icon} testId={testId}>
            {rows.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("engineV2.analytics.nothingYet")}</p>
            ) : (
                <table className="w-full text-sm">
                    <thead className="sr-only">
                        <tr>
                            <th>{title}</th>
                            <th>{column}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.key} className="relative">
                                <td className="relative py-1.5 pr-3">
                                    <span className="bg-primary/10 absolute inset-y-0.5 left-0 rounded" style={{ width: `${Math.max(1, row.share * 100)}%` }} aria-hidden />
                                    <span className="relative block truncate px-1.5">{label(row)}</span>
                                </td>
                                <td className="w-16 py-1.5 text-right tabular-nums">{(row[metric] ?? 0).toLocaleString(locale)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {extra}
        </Card>
    );
}

/** One bar per bucket (hour or day) of visits or page views; a tooltip on hover/focus and a table for screen readers. */
function VisitsChart({ answer }: { answer: SiteAnalyticsAnswer }) {
    const t = useT();
    const { locale } = useLocale();
    const [metric, setMetric] = React.useState<"visits" | "pageViews">("visits");
    const [hover, setHover] = React.useState<number | null>(null);
    const points = React.useMemo(() => fillSeries(answer), [answer]);
    const granularity = answer.window.granularity;
    const max = niceMax(Math.max(0, ...points.map(point => point[metric])));
    const height = 180;
    const when = (iso: string) => bucketLabel(iso, granularity, locale);
    const shown = hover === null ? null : points[hover];

    return (
        <Card
            testId="visits-chart"
            title={t(granularity === "day" ? "engineV2.analytics.chartDaily" : "engineV2.analytics.chartHourly")}
            description={granularity === "day" ? undefined : t("engineV2.analytics.chartHourlyHint")}
            aside={
                <Segmented<"visits" | "pageViews">
                    label={t("engineV2.analytics.chartMetric")}
                    value={metric}
                    onChange={setMetric}
                    options={[
                        { value: "visits", label: t("engineV2.analytics.visits") },
                        { value: "pageViews", label: t("engineV2.analytics.pageViews") },
                    ]}
                />
            }
        >
            <div className="relative">
                <div
                    className="text-muted-foreground pointer-events-none absolute top-0 left-0 flex w-8 -translate-y-1.5 flex-col justify-between text-right text-2xs tabular-nums"
                    style={{ height: height + 12 }}
                    aria-hidden
                >
                    <span>{max.toLocaleString(locale)}</span>
                    <span>{(max / 2).toLocaleString(locale)}</span>
                    <span>0</span>
                </div>
                <div className="ml-10">
                    <svg viewBox={`0 0 ${points.length} ${height}`} preserveAspectRatio="none" style={{ height }} className="w-full" role="presentation" onPointerLeave={() => setHover(null)}>
                        {[0, 0.5, 1].map(f => (
                            <line key={f} x1={0} x2={points.length} y1={height - f * height} y2={height - f * height} className="text-border stroke-current" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                        ))}
                        {points.map((point, i) => {
                            const h = max ? (point[metric] / max) * height : 0;
                            return (
                                <g key={point.t} onPointerEnter={() => setHover(i)}>
                                    <rect x={i} y={0} width={1} height={height} fill="transparent" />
                                    <rect
                                        x={i + 0.15}
                                        y={height - Math.max(h, point[metric] ? 2 : 0)}
                                        width={0.7}
                                        height={Math.max(h, point[metric] ? 2 : 0)}
                                        fill="var(--data-1)"
                                        opacity={hover === null || hover === i ? 1 : 0.45}
                                    />
                                </g>
                            );
                        })}
                    </svg>
                    <div className="text-muted-foreground mt-1.5 flex justify-between text-2xs" aria-hidden>
                        <span>{points[0] ? when(points[0].t) : ""}</span>
                        <span>{points.at(-1) ? when(points.at(-1)!.t) : ""}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 h-4 text-xs tabular-nums" aria-live="polite" data-testid="chart-tooltip">
                        {shown
                            ? `${when(shown.t)} · ${t("engineV2.analytics.visits")} ${shown.visits.toLocaleString(locale)} · ${t("engineV2.analytics.pageViews")} ${shown.pageViews.toLocaleString(locale)}`
                            : ""}
                    </p>
                </div>
            </div>
            <table className="sr-only">
                <caption>{t(granularity === "day" ? "engineV2.analytics.chartDaily" : "engineV2.analytics.chartHourly")}</caption>
                <thead>
                    <tr>
                        <th>{t("engineV2.analytics.when")}</th>
                        <th>{t("engineV2.analytics.visits")}</th>
                        <th>{t("engineV2.analytics.pageViews")}</th>
                    </tr>
                </thead>
                <tbody>
                    {points.map(point => (
                        <tr key={point.t}>
                            <td>{when(point.t)}</td>
                            <td>{point.visits}</td>
                            <td>{point.pageViews}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    );
}

/** Day buckets are UTC days (the server's); hour buckets are instants, shown in the reader's time. */
function bucketLabel(iso: string, granularity: SiteAnalyticsGranularity, locale: string): string {
    const date = new Date(iso);
    return granularity === "day"
        ? date.toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" })
        : date.toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function niceMax(value: number): number {
    if (value <= 4) return 4;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 2.5, 5, 10].find(s => s * magnitude >= value) ?? 10;
    return step * magnitude;
}
