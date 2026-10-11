/**
 * Pure helpers of the v2 database explorer's row editor, AI search and migrations list.
 *
 * Every row write goes through `POST …/database/sql` as ONE parameterised statement built here, so the server's guard
 * is the authority (DDL refused, `_migrations` read-only, a live write beside a dev database needs `confirmLive`) and
 * the user sees the exact SQL before it runs. Values are bound, never inlined; `inlineSql` exists only for display.
 */

import type { SqlTable } from "./vcaas-types";

export type Column = SqlTable["columns"][number];
export type SqlValue = string | number | null;
export interface Statement {
    sql: string;
    params: SqlValue[];
}

/** The server takes at most 100 bound parameters per statement. */
export const MAX_PARAMS = 100;

export type FieldKind = "text" | "long" | "number" | "integer" | "boolean" | "date" | "datetime" | "json" | "options" | "relation";

const LONG_NAMES = /(^|_)(content|body|description|bio|text|notes?|message|summary)$/;

export function fieldKind(column: Column): FieldKind {
    switch (column.kind) {
        case "relation":
        case "options":
        case "boolean":
        case "integer":
        case "number":
        case "date":
        case "datetime":
        case "json":
            return column.kind;
        case "multi_options":
        case "files":
            return "json";
        case "rich_text":
            return "long";
        default:
            return LONG_NAMES.test(column.name) ? "long" : "text";
    }
}

export const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * The columns that identify one row: `id` when it is unique, else the table's primary key (every column of a composite
 * key: matching on the first alone would reach every row that shares it), else every column flagged unique (a server
 * before `primaryKey` flagged each composite-key column unique). No key → not editable here.
 */
export function keyColumns(table: SqlTable): string[] {
    if (table.columns.some(c => c.name === "id" && c.unique)) return ["id"];
    if (table.primaryKey?.length) return table.primaryKey;
    return table.columns.filter(c => c.unique).map(c => c.name);
}

export const isEditable = (table: SqlTable) => table.kind !== "system" && keyColumns(table).length > 0;

/**
 * Listed with the app's own tables (E1): every non-system table, plus the sign-in `users` table once somebody signed
 * up (`usersHaveRows`: it is the app's user list). The other auth tables, `_migrations` and hidden tables stay under
 * "System tables".
 */
export const isAppTable = (table: SqlTable, usersHaveRows: boolean) =>
    !table.ui?.hidden && (table.kind !== "system" || (table.name === "users" && usersHaveRows));

const pad = (n: number) => String(n).padStart(2, "0");
function localDateTime(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const isIntegerType = (column: Column) => /^INT/i.test(column.sqlType);

/** A stored value as the form's input holds it (`datetime-local` wants local `YYYY-MM-DDTHH:mm`). */
export function toInput(column: Column, value: unknown): string | boolean {
    const kind = fieldKind(column);
    if (kind === "boolean") return value === 1 || value === true || value === "1" || value === "true";
    if (value === null || value === undefined) return "";
    if (kind === "datetime") {
        const date = typeof value === "number" ? new Date(value > 1e11 ? value : value * 1000) : new Date(String(value));
        return Number.isNaN(date.getTime()) ? String(value) : localDateTime(date);
    }
    if (kind === "date") return String(value).slice(0, 10);
    if (kind === "json" && typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
}

/**
 * SP7: the unit of an INTEGER timestamp with no stored value to copy (a new row in an empty table): its SQL default
 * says it (`unixepoch()` = seconds, `… * 1000` = ms), else the template's convention — Drizzle `mode: 'timestamp_ms'`.
 */
function integerTimestampInMs(column: Column): boolean {
    const d = column.default ?? "";
    if (/1000/.test(d)) return true;
    return !/unixepoch|strftime\s*\(\s*'%s'/i.test(d);
}

/** Whether the database fills the column when it is left out (a default, or SQLite's own rowid). */
const hasDefault = (column: Column) => column.default !== null || (isIntegerType(column) && column.unique && column.name === "id");
export const isRequired = (column: Column) => column.notNull && !hasDefault(column);

export type ParseError = "required" | "integer" | "number" | "datetime" | "date" | "json" | "option";
export type Parsed = { ok: true; value: SqlValue } | { ok: false; error: ParseError };

/**
 * The form's input back to the value bound in SQL, with the validation the user sees under the field. `original` is
 * the stored value (for a new row, the same column of a row already in the table), so an INTEGER timestamp keeps its
 * unit (milliseconds vs seconds). Error strings are i18n keys
 * under `engineV2.database.form`.
 */
export function fromInput(column: Column, input: string | boolean, original?: unknown): Parsed {
    const kind = fieldKind(column);
    if (kind === "boolean") return { ok: true, value: input ? 1 : 0 };
    const text = String(input);
    if (text.trim() === "") {
        // A required column, or a NOT NULL one that is not text (an empty number is no number), must be filled;
        // a NOT NULL text column with a default may hold ''. The form leaves empty defaulted columns out of an insert.
        if (isRequired(column) || (column.notNull && kind !== "text" && kind !== "long")) return { ok: false, error: "required" };
        return { ok: true, value: column.notNull ? "" : null };
    }
    switch (kind) {
        case "integer": {
            const n = Number(text);
            return Number.isInteger(n) ? { ok: true, value: n } : { ok: false, error: "integer" };
        }
        case "number": {
            const n = Number(text);
            return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: "number" };
        }
        case "datetime": {
            const date = new Date(text);
            if (Number.isNaN(date.getTime())) return { ok: false, error: "datetime" };
            if (!isIntegerType(column)) return { ok: true, value: date.toISOString() };
            const ms = typeof original === "number" ? original > 1e11 : integerTimestampInMs(column);
            return { ok: true, value: ms ? date.getTime() : Math.floor(date.getTime() / 1000) };
        }
        case "date":
            return /^\d{4}-\d{2}-\d{2}$/.test(text) ? { ok: true, value: text } : { ok: false, error: "date" };
        case "json":
            try {
                return { ok: true, value: JSON.stringify(JSON.parse(text)) };
            } catch {
                return { ok: false, error: "json" };
            }
        case "options":
            return column.options?.includes(text) ? { ok: true, value: text } : { ok: false, error: "option" };
        default:
            return { ok: true, value: text };
    }
}

/** What a new row starts with: a fresh id for a TEXT key without a default, and "now" for a required timestamp. */
export function newRowInputs(table: SqlTable, now = new Date(), newId = () => crypto.randomUUID()): Record<string, string | boolean> {
    const out: Record<string, string | boolean> = {};
    for (const column of table.columns) {
        const kind = fieldKind(column);
        if (column.name === "id" && column.unique && !isIntegerType(column) && column.default === null) out[column.name] = newId();
        else if (kind === "datetime" && isRequired(column)) out[column.name] = localDateTime(now);
        else if (kind === "boolean") out[column.name] = /^(1|true)$/i.test(column.default ?? "");
        else out[column.name] = "";
    }
    return out;
}

export function insertStatement(table: string, values: Record<string, SqlValue>): Statement {
    const names = Object.keys(values);
    if (names.length === 0) return { sql: `INSERT INTO ${ident(table)} DEFAULT VALUES RETURNING *`, params: [] };
    return {
        sql: `INSERT INTO ${ident(table)} (${names.map(ident).join(", ")}) VALUES (${names.map(() => "?").join(", ")}) RETURNING *`,
        params: names.map(name => values[name]),
    };
}

const keyParam = (value: unknown): SqlValue => (value === null || value === undefined ? null : typeof value === "number" ? value : String(value));

export function updateStatement(table: string, keys: string[], row: Record<string, unknown>, changes: Record<string, SqlValue>): Statement {
    const names = Object.keys(changes);
    return {
        sql: `UPDATE ${ident(table)} SET ${names.map(n => `${ident(n)} = ?`).join(", ")} WHERE ${keys.map(k => `${ident(k)} = ?`).join(" AND ")} RETURNING *`,
        params: [...names.map(n => changes[n]), ...keys.map(k => keyParam(row[k]))],
    };
}

/** One DELETE per ≤ 100 bound parameters; together they remove exactly the given rows. */
export function deleteStatements(table: string, keys: string[], rows: Record<string, unknown>[]): Statement[] {
    const per = Math.max(1, Math.floor(MAX_PARAMS / keys.length));
    const out: Statement[] = [];
    for (let i = 0; i < rows.length; i += per) {
        const chunk = rows.slice(i, i + per);
        const where =
            keys.length === 1
                ? `${ident(keys[0])} IN (${chunk.map(() => "?").join(", ")})`
                : chunk.map(() => `(${keys.map(k => `${ident(k)} = ?`).join(" AND ")})`).join(" OR ");
        out.push({ sql: `DELETE FROM ${ident(table)} WHERE ${where}`, params: chunk.flatMap(row => keys.map(k => keyParam(row[k]))) });
    }
    return out;
}

/** The statement with its values written in, for the "SQL that will run" preview only — never sent. */
export function inlineSql({ sql, params }: Statement): string {
    let i = 0;
    return sql.replace(/\?/g, () => {
        const value = params[i++];
        if (value === null || value === undefined) return "NULL";
        if (typeof value === "number") return String(value);
        const shown = value.length > 80 ? `${value.slice(0, 77)}…` : value;
        return `'${shown.replace(/'/g, "''")}'`;
    });
}

// ── Search with AI ────────────────────────────────────────────────────────

/** The question sent to `database/ask` for a plain-language filter on one table. */
export function aiFilterQuestion(table: string, filter: string): string {
    return `Return the rows of the table ${ident(table)} that match this description, as one statement of the form SELECT * FROM ${ident(table)} WHERE … (ORDER BY / LIMIT allowed, no other table unless inside the WHERE). Description: ${filter.trim()}`;
}

/** The WHERE clause of `SELECT * FROM <table> WHERE …`, or `null` when the AI's statement is not a filter of that table. */
export function whereOf(sql: string, table: string): string | null {
    const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`^\\s*select\\s+\\*\\s+from\\s+["\`\\[]?${escaped}["\`\\]]?\\s+(?:as\\s+\\w+\\s+)?where\\s+([\\s\\S]+?)\\s*;?\\s*$`, "i").exec(sql);
    if (!match) return null;
    return match[1].trim();
}

// ── Migrations ────────────────────────────────────────────────────────────

/** `0003_add_comments_table` → `{ number: "0003", title: "Add comments table" }`. */
export function migrationName(tag: string): { number: string; title: string } {
    const match = /^(\d+)_(.*)$/.exec(tag);
    const words = (match ? match[2] : tag).replace(/[_-]+/g, " ").trim();
    return { number: match ? match[1] : "", title: words ? words[0].toUpperCase() + words.slice(1) : tag };
}

/**
 * What a migration does, read from its SQL — the only readable name when Drizzle picked a random tag
 * (`0002_stale_forgotten_one`). `{ created: ["comments"], altered: ["posts"], dropped: [], indexes: 2 }`.
 */
export function migrationSummary(sql: string): { created: string[]; altered: string[]; dropped: string[]; indexes: number } {
    const names = (re: RegExp) => [...new Set([...sql.matchAll(re)].map(m => m[1]))];
    const table = "[`\"\\[]?([A-Za-z0-9_]+)[`\"\\]]?";
    return {
        created: names(new RegExp(`CREATE TABLE\\s+(?:IF NOT EXISTS\\s+)?${table}`, "gi")).filter(n => !n.startsWith("__new_")),
        altered: names(new RegExp(`ALTER TABLE\\s+${table}`, "gi")),
        dropped: names(new RegExp(`DROP TABLE\\s+(?:IF EXISTS\\s+)?${table}`, "gi")).filter(n => !n.startsWith("__new_")),
        indexes: [...sql.matchAll(/CREATE (?:UNIQUE )?INDEX/gi)].length,
    };
}

export interface JournalEntry {
    tag: string;
    when: number;
}
export interface MigrationItem {
    tag: string | null;
    when: number;
    hash: string | null;
    applied: boolean;
}

/**
 * The code's journal (`drizzle/meta/_journal.json`) joined with one database's `_migrations` ledger by
 * `created_at == when` (Drizzle's own rule, `scripts/migrate.ts`): applied ones, pending ones, and ledger rows the
 * code no longer knows. Newest first.
 */
export function joinMigrations(journal: JournalEntry[], ledger: { hash: unknown; created_at: unknown }[]): MigrationItem[] {
    const applied = new Map(ledger.map(row => [Number(row.created_at), String(row.hash)]));
    const items: MigrationItem[] = journal.map(entry => ({ tag: entry.tag, when: entry.when, hash: applied.get(entry.when) ?? null, applied: applied.has(entry.when) }));
    const known = new Set(journal.map(entry => entry.when));
    for (const [when, hash] of applied) if (!known.has(when)) items.push({ tag: null, when, hash, applied: true });
    return items.sort((a, b) => b.when - a.when);
}
