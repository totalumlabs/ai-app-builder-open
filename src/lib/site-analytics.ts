/**
 * Site analytics of a v2 project (A6.16): the shapes of `GET /projects/{id}/analytics/site` and the pure helpers the
 * Analytics page uses. Free to read; the numbers come from the dispatcher's own request log (no script in the site,
 * no cookie) of the published site and its domains only (never the preview). The server's `uniques` are visits: a
 * visitor is a daily-salted hash of IP + browser, so one person is one visit per day however many pages they open, and
 * a time series counts each visit once, in the bucket (hour or day) it starts in. Bots are excluded by the server.
 */

export type SiteAnalyticsMetric = "page_views" | "uniques";
export type SiteAnalyticsDimension = "path" | "referrer" | "country" | "device" | "browser" | "os";
export type SiteAnalyticsGranularity = "minute" | "hour" | "day";
export type RangePreset = "24h" | "7d" | "30d" | "custom";

export interface SiteAnalyticsWindow {
    from: string;
    to: string;
    granularity: SiteAnalyticsGranularity;
}
export interface SiteAnalyticsPoint {
    t: string;
    page_views?: number;
    uniques?: number;
}
export interface SiteAnalyticsRow {
    key: string;
    share: number;
    page_views?: number;
    uniques?: number;
}
export interface SiteAnalyticsAnswer {
    series?: SiteAnalyticsPoint[];
    top?: SiteAnalyticsRow[];
    window: SiteAnalyticsWindow;
    approximate: { uniques: boolean };
    cachedAt: string;
}

/** The server keeps 90 days of raw hits (`ANALYTICS_WINDOW_OUT_OF_RETENTION` beyond). */
export const RETENTION_DAYS = 90;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * The window of a preset, rounded to the minute (so repeated loads share the server's 60 s cache). A custom range is
 * two `YYYY-MM-DD` days, inclusive, read in UTC like the chart's buckets; it is clamped to the retention.
 */
export function rangeOf(preset: RangePreset, now: number, custom?: { from: string; to: string }): { from: string; to: string } | null {
    const to = Math.ceil(now / 60_000) * 60_000;
    if (preset !== "custom") {
        const span = preset === "24h" ? DAY : preset === "7d" ? 7 * DAY : 30 * DAY;
        return { from: new Date(to - span).toISOString(), to: new Date(to).toISOString() };
    }
    const from = Date.parse(`${custom?.from ?? ""}T00:00:00.000Z`);
    const end = Date.parse(`${custom?.to ?? ""}T00:00:00.000Z`) + DAY;
    if (!Number.isFinite(from) || !Number.isFinite(end) || from >= end) return null;
    const floor = to - RETENTION_DAYS * DAY + 60_000;
    return { from: new Date(Math.max(from, floor)).toISOString(), to: new Date(Math.min(end, to)).toISOString() };
}

/** The query string of one read (always the live site). `metric` order matters: the first one sorts the top lists. */
export function analyticsQuery(range: { from: string; to: string }, dimension?: SiteAnalyticsDimension): string {
    const q = new URLSearchParams({ from: range.from, to: range.to, env: "live", metric: dimension === "path" ? "page_views,uniques" : "uniques,page_views" });
    if (dimension) {
        q.set("dimension", dimension);
        q.set("limit", dimension === "device" ? "100" : "10");
    }
    return q.toString();
}

const BUCKET_MS: Record<SiteAnalyticsGranularity, number> = { minute: 60_000, hour: HOUR, day: DAY };

/** Every bucket of the window, with zeros where the server had no hit (it only answers buckets with data). */
export function fillSeries(answer: Pick<SiteAnalyticsAnswer, "series" | "window">): { t: string; pageViews: number; visits: number }[] {
    const step = BUCKET_MS[answer.window.granularity];
    const byTime = new Map((answer.series ?? []).map(point => [Date.parse(point.t), point]));
    const out: { t: string; pageViews: number; visits: number }[] = [];
    const end = Date.parse(answer.window.to);
    for (let t = Math.floor(Date.parse(answer.window.from) / step) * step; t < end && out.length < 2000; t += step) {
        const point = byTime.get(t);
        out.push({ t: new Date(t).toISOString(), pageViews: point?.page_views ?? 0, visits: point?.uniques ?? 0 });
    }
    return out;
}

/**
 * The headline numbers. Visits come from the device split: a visit's daily hash includes its browser, so each one is
 * in exactly one device class and the classes add up to the visits of the window (= the sum of its daily unique
 * visitors, and the sum of the chart's buckets, since the server counts a visit in the bucket it starts in).
 */
export function totalsOf(devices: SiteAnalyticsRow[] | undefined): { visits: number; pageViews: number; pagesPerVisit: number | null } {
    const visits = (devices ?? []).reduce((sum, row) => sum + (row.uniques ?? 0), 0);
    const pageViews = (devices ?? []).reduce((sum, row) => sum + (row.page_views ?? 0), 0);
    return { visits, pageViews, pagesPerVisit: visits > 0 ? pageViews / visits : null };
}

/**
 * The referrer list. The server's empty key also holds every hit that came from the site itself (moving between its
 * pages, loading its files), so it would always read "everyone came direct": it is replaced by the visits that no
 * other site sent (all visits minus the referred ones, never below zero), and the shares are of all visits.
 */
export function referrerRows(rows: SiteAnalyticsRow[] | undefined, visits: number): SiteAnalyticsRow[] {
    const referred = (rows ?? []).filter(row => row.key !== "");
    const direct = Math.max(0, visits - referred.reduce((sum, row) => sum + (row.uniques ?? 0), 0));
    const share = (n: number) => (visits > 0 ? Math.min(1, n / visits) : 0);
    return [...referred.map(row => ({ ...row, share: share(row.uniques ?? 0) })), ...(direct > 0 ? [{ key: "", uniques: direct, share: share(direct) }] : [])].sort(
        (a, b) => (b.uniques ?? 0) - (a.uniques ?? 0),
    );
}

/** The page list: only paths that were opened as pages (the server's list also holds files with no page view). */
export const pageRows = (rows: SiteAnalyticsRow[] | undefined): SiteAnalyticsRow[] => (rows ?? []).filter(row => (row.page_views ?? 0) > 0);

/** A country flag from its ISO code (`ES` → 🇪🇸); nothing for an unknown or empty code. */
export function flagOf(code: string): string {
    if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return "";
    return String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** A country's name in the reader's language (`ES` → "Spain" / "España"); the code when the browser cannot name it. */
export function countryName(code: string, locale: string): string {
    if (!/^[A-Z]{2}$/.test(code)) return code;
    try {
        return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
    } catch {
        return code;
    }
}
