/**
 * Client-side helpers of the v2 SQL panels (plan 15 §4.1.5–§4.1.6). The server is the
 * authority (DDL refused, `LIVE_DB_READ_ONLY`, 1,000-row cap); these only decide what the
 * UI offers before a statement leaves: a write is never run on the first click, and the
 * Ask panel never runs anything that is not a read.
 */

export type StatementKind = "select" | "write" | "ddl";

const READ = /^(select|with|explain|values|pragma)\b/;
const WRITE = /^(insert|update|delete|replace|upsert)\b/;
const DDL = /^(create|alter|drop|attach|detach|vacuum|reindex|analyze|begin|commit|rollback|savepoint|release)\b/;

/** Strip comments and string/identifier literals so keywords inside them never count. */
function skeleton(sql: string): string {
    return sql
        .replace(/--[^\n]*/g, " ")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`|\[[^\]]*\]/g, "''")
        .trim()
        .toLowerCase();
}

export function statementKind(sql: string): StatementKind {
    const s = skeleton(sql);
    if (READ.test(s)) {
        // `WITH … DELETE` and friends are writes; `PRAGMA x = y` changes the database.
        if (/^with\b/.test(s) && /\b(insert|update|delete|replace)\b/.test(s)) return "write";
        if (/^pragma\b/.test(s) && s.includes("=")) return "ddl";
        return "select";
    }
    if (WRITE.test(s)) return "write";
    if (DDL.test(s)) return "ddl";
    // B2-SW9: anything else (a typo such as `SELEC 1`) goes to the server, which answers its own syntax error and
    // refuses a write without `allowWrites`; calling it a schema change sent the user to migrations for a typo
    return "select";
}

/** Split a pasted script into statements on `;` outside quotes and comments. */
export function splitStatements(sql: string): string[] {
    const out: string[] = [];
    let current = "";
    let quote: string | null = null;
    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        if (quote) {
            current += ch;
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === "`") {
            quote = ch;
            current += ch;
        } else if (ch === "-" && sql[i + 1] === "-") {
            const end = sql.indexOf("\n", i);
            i = end === -1 ? sql.length : end;
            current += "\n";
        } else if (ch === ";") {
            if (current.trim()) out.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    if (current.trim()) out.push(current.trim());
    return out;
}

/** CSV with a UTF-8 BOM; every cell quoted so `;`, `,`, quotes and newlines survive Excel. */
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
    const cell = (value: unknown) => {
        const text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
        return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [columns.map(cell).join(","), ...rows.map(row => columns.map(column => cell(row[column])).join(","))];
    return "﻿" + lines.join("\r\n");
}
