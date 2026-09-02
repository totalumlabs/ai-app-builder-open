/**
 * ═══ THE TWO LOG STREAMS (Feature F9) ═══════════════════════════════════════
 *
 * ⚠️⚠️ THEY ARE GENUINELY DIFFERENT RUNTIMES, AND PHASE 09 GOT THIS WRONG.
 * That phase shipped one tab on the assumption that "the dev server on PORT 80
 * serves both the preview and the published site", so one endpoint covered
 * everything. It does not, and the code says so:
 *
 *   · **Dev** — `GET …/backend/dev/logs` → `totalum-backend`'s
 *     `getStartumBackendDevLogs`, which is literally
 *     `cat /app/user-project/npm-start.log` **on the sandbox VM**. It is the dev
 *     server's stdout/stderr and nothing else.
 *   · **Production** — `GET …/backend/prod/logs` → `getProdLogs`, which POSTs to a
 *     **Cloudflare Logpush worker** and returns its records verbatim. A published
 *     project runs on Cloudflare (`deploy-to-cloudflare`), so its request logs
 *     exist ONLY here — they never touch the sandbox.
 *
 * So someone debugging their live site on the old single tab was reading the wrong
 * machine. That is the bug F9 fixes; the copy in `workspace.logs.*` was corrected
 * in the same pass.
 *
 * This module is PURE — no fetch, no React. It turns either source into the same
 * `LogLine[]`, so one renderer, one search, one copy/download path serves both.
 */

// ─── The shared display model ────────────────────────────────────────────────

export type LogLevel = "error" | "warn" | "info" | "debug" | "plain";

export interface LogLine {
    text: string;
    level: LogLevel;
    /**
     * `true` for a production request header (`GET /path 200 · 12 ms`), which is
     * rendered slightly stronger than the console lines nested under it.
     */
    heading?: boolean;
}

// ─── Dev: an unstructured text blob ──────────────────────────────────────────

/**
 * Classify a dev-log line for colouring.
 *
 * Deliberately conservative and case-insensitive: this is unstructured output from
 * whatever the generated app prints, so there is no schema to rely on.
 * Over-matching would paint half the panel red and make the colour useless.
 *
 * (Unchanged from Phase 09 — moved here so both sources share one palette and so it
 * is unit-testable.)
 */
export function classify(line: string): LogLevel {
    const text = line.toLowerCase();
    if (/\b(error|err|fatal|exception|failed|unhandled)\b/.test(text) || text.includes("✗")) return "error";
    if (/\b(warn|warning|deprecated)\b/.test(text)) return "warn";
    if (/\b(info|ready|started|listening|compiled|success)\b/.test(text) || text.includes("✓")) return "info";
    if (/\b(debug|trace|verbose)\b/.test(text)) return "debug";
    return "plain";
}

/** The dev blob, split and classified. An empty blob yields no lines at all. */
export function devLogLines(blob: string): LogLine[] {
    if (!blob) return [];
    return blob.split("\n").map(text => ({ text, level: classify(text) }));
}

// ─── Production: Cloudflare Workers trace events ─────────────────────────────

/**
 * One Logpush record, as the worker emits it.
 *
 * ⚠️ EVERY FIELD IS OPTIONAL ON PURPOSE. This is a passthrough from a third-party
 * worker (`GetProductionLogsOutput` on account-backend is literally
 * `{ [key: string]: any }`), so the shape is not ours to guarantee. A record missing
 * everything still renders one honest line rather than throwing inside a panel.
 */
export interface ProdLogRecord {
    EventTimestampMs?: number;
    Outcome?: string;
    WallTimeMs?: number;
    CPUTimeMs?: number;
    Event?: {
        Request?: { URL?: string; Method?: string };
        Response?: { Status?: number };
    };
    Logs?: { Level?: string; Message?: unknown; TimestampMs?: number }[];
    Exceptions?: { Name?: string; Message?: string; TimestampMs?: number }[];
}

/**
 * Find the records array in whatever the worker sent.
 *
 * ⚠️ FOUR SHAPES ARE ACCEPTED, and that is not defensiveness theatre — the legacy
 * Angular panel (`startum-previewer.component.ts → loadBackendProdLogs`) checks the
 * same set, which is the evidence that the payload has genuinely varied. Anything
 * unrecognised yields `[]`, i.e. "no logs", never a crash.
 */
export function extractProdRecords(payload: unknown): ProdLogRecord[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload as ProdLogRecord[];

    const object = payload as Record<string, unknown>;

    if (Array.isArray(object.records)) return object.records as ProdLogRecord[];

    const data = object.data as Record<string, unknown> | unknown[] | undefined;
    if (Array.isArray(data)) return data as ProdLogRecord[];
    if (data && Array.isArray((data as Record<string, unknown>).records)) {
        return (data as { records: ProdLogRecord[] }).records;
    }

    return [];
}

/** `Message` is an array of anything; objects are JSON, everything else is String(). */
function messageToText(message: unknown): string {
    const parts = Array.isArray(message) ? message : [message];
    return parts
        .map(part => {
            if (part === null || part === undefined) return "";
            if (typeof part === "string") return part;
            try {
                return JSON.stringify(part);
            } catch {
                return String(part);
            }
        })
        .filter(Boolean)
        .join(" ");
}

/** `2026-08-02T09:14:03.120Z` → `09:14:03`. Empty when there is no timestamp. */
export function formatLogTime(ms: number | undefined, locale: string): string {
    if (!ms || !Number.isFinite(ms)) return "";
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);
}

/** HTTP status → colour. 5xx is an error, 4xx a warning, 2xx/3xx information. */
function levelForStatus(status: number | undefined, outcome?: string): LogLevel {
    if (outcome && outcome !== "ok" && outcome !== "canceled") return "error";
    if (!status) return "plain";
    if (status >= 500) return "error";
    if (status >= 400) return "warn";
    return "info";
}

const CONSOLE_LEVELS: Record<string, LogLevel> = {
    error: "error",
    fatal: "error",
    warn: "warn",
    warning: "warn",
    info: "info",
    log: "plain",
    debug: "debug",
    trace: "debug",
};

/**
 * ⭐ ONE REQUEST → ONE HEADING LINE PLUS ITS NESTED OUTPUT.
 *
 * Production logs are structured request records, not a text stream, but the panel
 * that renders them already does search, level colouring, copy, download, autoscroll
 * and the jump pill over LINES. Flattening here means all of that keeps working
 * unchanged and production still reads the way a server log should:
 *
 *   09:14:03  GET /api/orders → 500 · 128 ms
 *     console.error  Cannot read properties of undefined
 *     ✗ TypeError: Cannot read properties of undefined
 *
 * The alternative — a second, collapsible renderer just for production — would have
 * meant two search implementations and two copy paths for one feature.
 */
export function prodLogLines(records: ProdLogRecord[], locale: string): LogLine[] {
    const lines: LogLine[] = [];

    // Oldest first, so the newest is at the bottom — the same direction as the dev
    // stream, which is what makes "jump to latest" mean one thing in both tabs.
    const ordered = [...records].sort(
        (a, b) => (a.EventTimestampMs || 0) - (b.EventTimestampMs || 0)
    );

    for (const record of ordered) {
        const time = formatLogTime(record.EventTimestampMs, locale);
        const method = record.Event?.Request?.Method || "GET";
        const status = record.Event?.Response?.Status;
        const outcome = record.Outcome;

        let path = "/";
        const rawUrl = record.Event?.Request?.URL;
        if (rawUrl) {
            try {
                const url = new URL(rawUrl);
                path = url.pathname + url.search;
            } catch {
                // Not an absolute URL — show whatever was sent rather than "/".
                path = rawUrl;
            }
        }

        const duration = Number.isFinite(record.WallTimeMs) ? ` · ${Math.round(record.WallTimeMs!)} ms` : "";
        const statusText = status ? ` → ${status}` : "";
        // An outcome worth mentioning is one that is not a plain success.
        const outcomeText = outcome && outcome !== "ok" ? ` [${outcome}]` : "";

        lines.push({
            text: `${time ? `${time}  ` : ""}${method} ${path}${statusText}${duration}${outcomeText}`,
            level: levelForStatus(status, outcome),
            heading: true,
        });

        for (const entry of record.Logs || []) {
            const level = CONSOLE_LEVELS[String(entry.Level || "log").toLowerCase()] ?? "plain";
            const text = messageToText(entry.Message);
            if (!text) continue;
            lines.push({ text: `    ${text}`, level });
        }

        for (const exception of record.Exceptions || []) {
            const name = exception.Name || "Error";
            const message = exception.Message || "";
            lines.push({ text: `    ✗ ${name}${message ? `: ${message}` : ""}`, level: "error" });
        }
    }

    return lines;
}

/** Plain text for copy and download — the same thing the user is looking at. */
export function linesToText(lines: LogLine[]): string {
    return lines.map(line => line.text).join("\n");
}

/** Case-insensitive substring filter over the rendered text. */
export function filterLines(lines: LogLine[], query: string): LogLine[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return lines;
    return lines.filter(line => line.text.toLowerCase().includes(needle));
}

// ─── Production query window ─────────────────────────────────────────────────

/**
 * ⚠️ THE WORKER ONLY KEEPS THREE DAYS, and `from`/`to` outside that window are
 * rejected upstream. The panel never sends a range the user did not ask for, but
 * when it does send one it is clamped here.
 */
export const PROD_LOGS_WINDOW_DAYS = 3;

export function clampProdRange(from: Date, now: Date = new Date()): Date {
    const earliest = new Date(now.getTime() - PROD_LOGS_WINDOW_DAYS * 24 * 3600 * 1000);
    return from < earliest ? earliest : from;
}

/**
 * ⚠️⚠️ WHY THE PANEL MUST ALWAYS SEND `from` — THE SIX-HOUR TRAP.
 *
 * The `startum-logs` worker decides the window like this (verified against the
 * deployed script):
 *
 *   const hasAnyFilter = query?.from || query?.to || query?.regexSearch?.trim()
 *   const fromMs = query?.from ? Date.parse(query.from)
 *                              : Date.now() - (hasAnyFilter ? RETENTION_MS : SIX_HOURS)
 *
 * So a request carrying no `query` at all — which is what this panel sent until
 * now — is answered from the **last six hours only**, while every string in
 * `workspace.logs.*` promises three days. A site whose last visitor was this
 * morning read as "nothing from production yet", and the user had no control to
 * widen it: unlike the legacy Angular panel, there were no date pickers here.
 *
 * ⚠️ `getOnlyLastLogs` DOES NOT DO THIS. It is forwarded faithfully by
 * account-backend and totalum-backend and then **ignored by the worker** — it
 * reads `body.query` and nothing else. Sending it is harmless; relying on it to
 * mean "the recent slice" is not.
 *
 * Hence: one explicit range per fetch, always.
 */
export const PROD_RANGE_HOURS = [1, 6, 24, PROD_LOGS_WINDOW_DAYS * 24] as const;

export type ProdRangeHours = (typeof PROD_RANGE_HOURS)[number];

/** The default: wide enough that a quiet site still shows yesterday's traffic. */
export const DEFAULT_PROD_RANGE_HOURS: ProdRangeHours = 24;

/**
 * `from` for a "last N hours" window, clamped to what the worker still holds.
 * `to` is deliberately not sent — the worker defaults it to now, and pinning it
 * client-side would drop records that arrive during the request.
 */
export function prodRangeFrom(hours: number, now: Date = new Date()): string {
    return clampProdRange(new Date(now.getTime() - hours * 3600 * 1000), now).toISOString();
}
