/**
 * Pure helpers behind the v2 project pages (Usage & limits, Project API keys, Payments, Mobile apps, Cron jobs).
 * No React, no fetch — tested by `src/lib/__tests__/v2-pages.test.tsx`.
 *
 * Everything here turns an API answer into plain words or a simple shape; the numbers themselves stay the server's.
 */

import type { Translate } from "@/i18n/types";
import type { CronJob, ProjectApiKey, V2Usage } from "@/lib/vcaas-types";

// ─────────────────────────────── Usage ───────────────────────────────

/** The groups a non-technical reader recognises; every usage dimension falls in exactly one (unknown → `other`). */
export const USAGE_GROUPS = [
    "building", "actions", "hosting", "database", "files", "ai", "web", "browser", "email", "scan", "pdf",
    "realtime", "vectors", "mobile", "cron", "fees", "other",
] as const;
export type UsageGroup = (typeof USAGE_GROUPS)[number];

const GROUP_OF: Record<string, UsageGroup> = {
    agent_runs: "building", visual_edit: "building",
    create_project: "actions", deploy: "actions", get_source_code: "actions", recover_version: "actions",
    rebuild_project: "actions", export_project: "actions", import_project: "actions", legacy_migration: "actions", upload_file: "actions",
    database_export: "actions", turso_migration: "actions", start_server: "actions", update_file: "actions",
    lifecycle_pause: "actions", lifecycle_resume: "actions", backup_create: "database", backup_restore: "database",
    requests: "hosting", cpu_ms: "hosting", cron_runs: "cron",
    rows_read: "database", rows_written: "database", db_storage_gb_month: "database", d1_usage: "database", turso_usage: "database",
    r2_gb_month: "files", r2_class_a: "files", r2_class_b: "files", storage_monthly: "files",
    ai_chat: "ai", image_generation: "ai", image_edit: "ai", ai_video: "ai", ai_embed: "ai", ai_rerank: "ai",
    ai_speech_stt: "ai", ai_speech_tts: "ai",
    web_scraper: "web", web_search: "web", web_extract: "web",
    browser_session: "browser", browser_proxy: "browser", browser_captcha: "browser",
    email: "email", document_scan: "scan", pdf: "pdf", screenshot: "pdf",
    realtime_room_minutes: "realtime", realtime_messages: "realtime", realtime_storage_bytes: "realtime",
    vectors: "vectors", vectors_storage: "vectors",
    mobile_build_android: "mobile", mobile_build_ios_cloud: "mobile", mobile_build_ios_project: "mobile",
    project_monthly_fee: "fees", custom_domain_monthly_fee: "fees", add_custom_domain: "fees",
};

export function usageGroupOf(dimension: string): UsageGroup {
    return GROUP_OF[dimension] ?? "other";
}

/** Credits per group, biggest first, zero groups dropped. Sums the server's per-dimension credits (never invents one). */
export function usageByGroup(usage: V2Usage | null | undefined): { group: UsageGroup; credits: number }[] {
    const sums = new Map<UsageGroup, number>();
    for (const [dimension, entry] of Object.entries(usage?.totals?.byDimension ?? {})) {
        const credits = typeof entry?.credits === "number" ? entry.credits : 0;
        if (credits <= 0) continue;
        const group = usageGroupOf(dimension);
        sums.set(group, (sums.get(group) ?? 0) + credits);
    }
    return [...sums.entries()]
        .map(([group, credits]) => ({ group, credits: Math.round(credits * 10_000) / 10_000 }))
        .sort((a, b) => b.credits - a.credits);
}

/** A credit amount a person can read: `42`, `3.5`, `0.07`, `< 0.01` for a tiny non-zero amount, `0` for none. */
export function formatCreditAmount(credits: number | null | undefined, locale: "en" | "es"): string {
    if (typeof credits !== "number" || !Number.isFinite(credits) || credits === 0) return "0";
    const intl = locale === "es" ? "es-ES" : "en-GB";
    if (Math.abs(credits) < 0.01) return `< ${new Intl.NumberFormat(intl).format(0.01)}`;
    const digits = Math.abs(credits) >= 100 ? 0 : Math.abs(credits) >= 10 ? 1 : 2;
    return new Intl.NumberFormat(intl, { maximumFractionDigits: digits }).format(credits);
}

/** How full a budget is: `null` without a cap; `warn` from 80 %, `reached` at 100 %. */
export function budgetState(used: number, cap: number | null | undefined): { percent: number; level: "ok" | "warn" | "reached" } | null {
    if (typeof cap !== "number") return null;
    if (cap <= 0) return { percent: 100, level: "reached" };
    const percent = Math.min(100, Math.round((used / cap) * 100));
    return { percent, level: used >= cap ? "reached" : percent >= 80 ? "warn" : "ok" };
}

/** The first day of next month (UTC): when every monthly budget starts again. */
export function nextMonthStart(now = new Date()): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

// ─────────────────────────────── Cron ───────────────────────────────

export type CronFrequency = "minutes" | "hourly" | "daily" | "weekdays" | "weekly" | "monthly" | "custom";
export interface CronForm {
    frequency: CronFrequency;
    /** `minutes`: every N minutes. */
    every: number;
    /** `HH:MM` in the job's zone (daily / weekdays / weekly / monthly); the minute past the hour for `hourly`. */
    time: string;
    /** 0 = Sunday … 6 = Saturday (`weekly`). */
    weekday: number;
    /** 1–28 (`monthly`). */
    day: number;
    /** `custom`: a raw 5-field expression. */
    expression: string;
}

export const DEFAULT_CRON_FORM: CronForm = { frequency: "daily", every: 15, time: "09:00", weekday: 1, day: 1, expression: "0 9 * * *" };

const hm = (time: string): [number, number] => {
    const [h, m] = time.split(":").map(n => Number.parseInt(n, 10));
    return [Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0, Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0];
};

/** The 5-field cron expression the form describes (in the job's `timezone`, UTC without one). */
export function buildCron(form: CronForm): string {
    const [h, m] = hm(form.time);
    switch (form.frequency) {
        case "minutes":
            return `*/${Math.max(1, Math.min(59, Math.round(form.every)))} * * * *`;
        case "hourly":
            return `${m} * * * *`;
        case "daily":
            return `${m} ${h} * * *`;
        case "weekdays":
            return `${m} ${h} * * 1-5`;
        case "weekly":
            return `${m} ${h} * * ${form.weekday}`;
        case "monthly":
            return `${m} ${h} ${Math.max(1, Math.min(28, form.day))} * *`;
        default:
            return form.expression.trim().replace(/\s+/g, " ");
    }
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const two = (n: number) => String(n).padStart(2, "0");
const isInt = (s: string, min: number, max: number) => /^\d+$/.test(s) && Number(s) >= min && Number(s) <= max;

/**
 * A schedule in words: "Every day at 09:00 UTC", "Every 15 minutes", "Every Monday at 08:30 UTC". An expression this
 * does not recognise comes back as "Custom schedule: <expression>" — never a wrong sentence. With `local`, a schedule at a
 * fixed UTC time also says that time in the viewer's zone ("… 08:30 UTC · 10:30 your time"), at today's offset. A job
 * with its own `zone` (cron2: the scheduler keeps it at that local time all year) reads "… 09:00 (Europe/Madrid)".
 */
export function describeSchedule(schedule: CronJob["schedule"], t: Translate, local?: { timeZone: string; now?: Date }, zone?: string): string {
    if (typeof schedule !== "string") {
        const n = schedule.everyMinutes;
        return n % 60 === 0 && n >= 60
            ? n === 60 ? t("engineV2.cron.every.hour") : t("engineV2.cron.every.nHours", { n: n / 60 })
            : n === 1 ? t("engineV2.cron.every.minute") : t("engineV2.cron.every.nMinutes", { n });
    }
    const fields = schedule.trim().split(/\s+/);
    const custom = t("engineV2.cron.every.custom", { expression: schedule.trim() });
    if (fields.length !== 5) return custom;
    const [min, hour, dom, mon, dow] = fields;
    if (mon !== "*") return custom;
    const step = /^\*\/(\d+)$/;
    if (hour === "*" && dom === "*" && dow === "*") {
        if (min === "*") return t("engineV2.cron.every.minute");
        const s = step.exec(min);
        if (s) return Number(s[1]) === 1 ? t("engineV2.cron.every.minute") : t("engineV2.cron.every.nMinutes", { n: Number(s[1]) });
        if (isInt(min, 0, 59)) return Number(min) === 0 ? t("engineV2.cron.every.hour") : t("engineV2.cron.every.hourAt", { minute: two(Number(min)) });
        return custom;
    }
    if (!isInt(min, 0, 59)) return custom;
    const hs = step.exec(hour);
    if (hs && dom === "*" && dow === "*") return t("engineV2.cron.every.nHours", { n: Number(hs[1]) });
    if (!isInt(hour, 0, 23)) return custom;
    const time = `${two(Number(hour))}:${two(Number(min))}`;
    const tz = zone && zone !== "UTC" ? `(${zone})` : "UTC";
    const words =
        dom === "*" && dow === "*"
            ? t("engineV2.cron.every.day", { time, tz })
            : dom === "*" && dow === "1-5"
              ? t("engineV2.cron.every.weekday", { time, tz })
              : dom === "*" && isInt(dow, 0, 7)
                ? t("engineV2.cron.every.week", { day: t(`engineV2.cron.days.${WEEKDAY_KEYS[Number(dow) % 7]}`), time, tz })
                : dow === "*" && isInt(dom, 1, 31)
                  ? t("engineV2.cron.every.month", { day: Number(dom), time, tz })
                  : null;
    if (!words || !local || tz !== "UTC") return words ?? custom;
    const at = localTimeOf(Number(hour), Number(min), local.timeZone, local.now ?? new Date());
    const key = at.dayShift > 0 ? "yourTimeNextDay" : at.dayShift < 0 ? "yourTimePrevDay" : "yourTime";
    return t(`engineV2.cron.${key}`, { words, time: at.time });
}

/** `hour:minute` UTC on `now`'s UTC day, in `timeZone`: its clock time and whether it falls on the day before/after. */
function localTimeOf(hour: number, minute: number, timeZone: string, now: Date): { time: string; dayShift: number } {
    const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
            .formatToParts(utc)
            .map(part => [part.type, part.value])
    );
    const localDay = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
    const utcDay = Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
    return { time: `${parts.hour}:${parts.minute}`, dayShift: Math.sign(localDay - utcDay) };
}

/** cron2: the "pause after N failed runs in a row" choices offered (the API takes any 1–100; `null` = never). */
export const PAUSE_AFTER_CHOICES: (number | null)[] = [1, 3, 5, 10, 25, 50, 100, null];

/** cron2: the choices for a job whose setting may be any 1–100 (set through the API): its own value joins the presets. */
export function pauseChoices(current: number | null | undefined): (number | null)[] {
    if (current == null || PAUSE_AFTER_CHOICES.includes(current)) return PAUSE_AFTER_CHOICES;
    return [...PAUSE_AFTER_CHOICES.filter(n => n !== null && n < current), current, ...PAUSE_AFTER_CHOICES.filter(n => n === null || n > current)];
}

/** cron2: a job's failure setting in words (`undefined` = the default 3; `null` = never, told once after 10). */
export function failurePolicy(pauseAfterFailures: number | null | undefined, t: Translate): string {
    if (pauseAfterFailures === null) return t("engineV2.cron.neverPause");
    const n = pauseAfterFailures ?? 3;
    return t(n === 1 ? "engineV2.cron.pauseAfterOne" : "engineV2.cron.pauseAfter", { n });
}

/** A cron run's outcome: `ok` for a 2xx/3xx answer, `failed` otherwise, `skipped` when it was not fired. */
export function runOutcome(status: number | "timeout" | "error" | "skipped" | undefined): "ok" | "failed" | "skipped" | null {
    if (status === undefined) return null;
    if (status === "skipped") return "skipped";
    return typeof status === "number" && status < 400 ? "ok" : "failed";
}

// ─────────────────────────────── API keys ───────────────────────────────

/** `app` runs the app, `env` is inside the downloaded .env files, `custom` is one the owner created. */
export function keyKind(key: Pick<ProjectApiKey, "managed">): "app" | "env" | "custom" {
    return key.managed === "app" ? "app" : key.managed === "env" ? "env" : "custom";
}

/** The three permission choices of "Create a key"; `custom` = any other set (advanced). */
export const SCOPE_PRESETS = {
    read: ["db:read"],
    readWrite: ["db:read", "db:write", "integrations:*"],
    full: ["db:read", "db:write", "db:schema", "integrations:*"],
} as const;
export type ScopePreset = keyof typeof SCOPE_PRESETS | "custom";

export function presetOf(scopes: readonly string[]): ScopePreset {
    const set = [...scopes].sort().join(",");
    for (const [name, list] of Object.entries(SCOPE_PRESETS)) if ([...list].sort().join(",") === set) return name as ScopePreset;
    return "custom";
}

// ─────────────────────────────── Mobile ───────────────────────────────

/** When the next build may start, from a `429 MOBILE_BUILD_RATE_LIMITED` answer's details (`retryAt` or `retryAfterSeconds`). */
export function retryAtOf(details: unknown, now = Date.now()): Date | null {
    const d = (details ?? {}) as { retryAt?: unknown; retryAfterSeconds?: unknown };
    if (typeof d.retryAt === "string" && !Number.isNaN(Date.parse(d.retryAt))) return new Date(d.retryAt);
    if (typeof d.retryAfterSeconds === "number" && d.retryAfterSeconds > 0) return new Date(now + d.retryAfterSeconds * 1000);
    return null;
}
