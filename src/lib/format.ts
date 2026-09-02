import type { Locale } from "@/i18n";

/**
 * Locale-aware formatting helpers.
 *
 * ⚠️ ALWAYS PASS THE LOCALE EXPLICITLY. `Intl` defaults to the runtime's locale,
 * which on the server is the container's (usually `en-US`) and in the browser is
 * the user's OS setting — so an implicit default renders one string during SSR and
 * a different one after hydration. Every function here takes `locale` as a required
 * argument to make that impossible to forget.
 */

const INTL_LOCALE: Record<Locale, string> = {
    en: "en-GB",
    es: "es-ES",
};

/** `15 Mar 2026`. Returns "" for a missing or unparseable date rather than "Invalid Date". */
export function formatDate(value: string | Date | null | undefined, locale: Locale): string {
    const date = toDate(value);
    if (!date) return "";

    return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? INTL_LOCALE.en, {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(date);
}

/**
 * `3 days ago` / `hace 3 días`, falling back to an absolute date beyond a month —
 * "8 months ago" is less useful than "15 Mar 2026" when scanning a project list.
 */
export function formatRelativeDate(
    value: string | Date | null | undefined,
    locale: Locale
): string {
    const date = toDate(value);
    if (!date) return "";

    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const absSeconds = Math.abs(seconds);

    if (absSeconds > 30 * 24 * 3600) return formatDate(date, locale);

    const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale] ?? INTL_LOCALE.en, {
        numeric: "auto",
    });

    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ["day", 24 * 3600],
        ["hour", 3600],
        ["minute", 60],
    ];

    for (const [unit, secondsPerUnit] of units) {
        if (absSeconds >= secondsPerUnit) {
            return rtf.format(Math.round(seconds / secondsPerUnit), unit);
        }
    }

    return rtf.format(0, "minute");
}

/**
 * `15 Mar 2026, 14:32` — a date AND a time, in the app's locale.
 *
 * ⚠️ ADDED FOR THE DATABASE CMS, which was rendering raw ISO strings
 * (`2026-03-15T14:32:11.842Z`) in its table cells and calling bare
 * `toLocaleString()` — the RUNTIME's locale — in the record detail. Both are
 * wrong for the same reason `formatDate` exists: the locale must be the one the
 * user chose, not the one the container or the OS happens to have.
 *
 * `hour12: false` is deliberate and matches `en-GB`/`es-ES`, the two locales this
 * product ships. A 24-hour clock also keeps the column width stable, which
 * matters in a table.
 */
export function formatDateTime(value: string | Date | null | undefined, locale: Locale): string {
    const date = toDate(value);
    if (!date) return "";

    return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? INTL_LOCALE.en, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
}

/**
 * Is this string an ISO-8601 timestamp?
 *
 * ⚠️ IT EXISTS BECAUSE THE SCHEMA DOES NOT COVER EVERY DATE. `createdAt`,
 * `updatedAt` and any date nested inside a record arrive as strings with no
 * `DbProperty` to consult, so the CMS would print them raw. This is deliberately
 * STRICT — a full ISO timestamp, nothing looser — because the alternative
 * (anything `new Date()` can parse) turns ordinary strings like `"2026"` and even
 * some product names into dates.
 */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export function isIsoDateString(value: unknown): value is string {
    return typeof value === "string" && ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

/** True when an ISO string carries a time component worth showing. */
export function isoHasTime(value: string): boolean {
    return /[T ]\d{2}:\d{2}/.test(value);
}

function toDate(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
