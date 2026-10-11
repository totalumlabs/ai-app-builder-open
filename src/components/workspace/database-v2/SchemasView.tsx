"use client";

import * as React from "react";
import { ArrowRightIcon, KeyRoundIcon, SearchIcon, TableIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";
import { isAppTable } from "@/lib/db-v2-form";
import type { SqlTable } from "@/lib/vcaas-types";

const anchor = (table: string) => `db-schema-${table}`;

/** A table matches on its name or label (every column shown), else only its columns that match. */
function filterTables(tables: SqlTable[], query: string, usersHaveRows: boolean) {
    const q = query.trim().toLowerCase();
    const ordered = [...tables.filter(t => isAppTable(t, usersHaveRows)), ...tables.filter(t => !isAppTable(t, usersHaveRows))];
    if (!q) return ordered.map(table => ({ table, columns: table.columns }));
    return ordered
        .map(table => {
            if (table.name.toLowerCase().includes(q) || table.label?.toLowerCase().includes(q)) return { table, columns: table.columns };
            return { table, columns: table.columns.filter(c => c.name.toLowerCase().includes(q) || c.sqlType.toLowerCase().includes(q)) };
        })
        .filter(item => item.columns.length > 0);
}

/**
 * "Schemas" (E2): every table's columns, types, keys and relations on one searchable page. Each column is one row that
 * wraps on a phone (name and type first, its keys below) instead of a wide table; a relation jumps to its table.
 */
export function SchemasView({ tables, usersHaveRows, onOpenTable }: { tables: SqlTable[]; usersHaveRows: boolean; onOpenTable: (table: string) => void }) {
    const t = useT();
    const [query, setQuery] = React.useState("");
    const shown = filterTables(tables, query, usersHaveRows);
    const jump = (table: string) => document.getElementById(anchor(table))?.scrollIntoView({ behavior: "smooth", block: "start" });

    return (
        <div className="space-y-3" data-testid="db-schemas">
            <div className="relative max-w-sm">
                <SearchIcon className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden />
                <Input
                    className="h-8 pl-7"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={t("engineV2.database.schemasSearch")}
                    aria-label={t("engineV2.database.schemasSearch")}
                />
            </div>
            {shown.length === 0 ? <p className="text-muted-foreground text-xs">{t("engineV2.database.schemasNone", { query: query.trim() })}</p> : null}
            {shown.map(({ table, columns }) => {
                const incoming = tables.flatMap(other => other.foreignKeys.filter(fk => fk.table === table.name).map(fk => ({ from: other.name, ...fk })));
                return (
                    <section key={table.name} id={anchor(table.name)} className="border-border scroll-mt-2 rounded-lg border" aria-label={table.name}>
                        <header className="border-border bg-muted/40 flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-3 py-2">
                            <TableIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                            <button type="button" className="min-w-0 truncate font-mono text-sm font-semibold hover:underline" onClick={() => onOpenTable(table.name)}>
                                {table.name}
                            </button>
                            {table.label && table.label !== table.name ? <span className="text-muted-foreground truncate text-xs">{table.label}</span> : null}
                            {!isAppTable(table, usersHaveRows) ? <span className="text-muted-foreground rounded border px-1.5 text-[10px] uppercase">{t("engineV2.database.schemaSystem")}</span> : null}
                            {table.rowCount !== undefined ? (
                                <span className="text-muted-foreground ml-auto text-xs tabular-nums">{t("engineV2.database.rowsTotal", { count: table.rowCount })}</span>
                            ) : null}
                        </header>
                        <ul className="divide-border divide-y">
                            {columns.map(column => {
                                const pk = table.primaryKey?.includes(column.name) || (!table.primaryKey?.length && column.name === "id" && column.unique);
                                const fks = table.foreignKeys.filter(fk => fk.column === column.name);
                                return (
                                    <li key={column.name} className="grid gap-x-3 gap-y-1 px-3 py-1.5 text-xs sm:grid-cols-[minmax(9rem,1fr)_8rem_2fr]">
                                        <span className="flex min-w-0 items-center gap-1.5 font-mono font-medium break-all">
                                            {pk ? <KeyRoundIcon className="size-3 shrink-0 text-amber-600" aria-label="PRIMARY KEY" /> : null}
                                            {column.name}
                                            <span className="text-muted-foreground font-normal sm:hidden">· {column.sqlType}</span>
                                        </span>
                                        <span className="text-muted-foreground hidden font-mono sm:block">{column.sqlType}</span>
                                        <span className="flex flex-wrap items-center gap-1">
                                            {pk ? <Tag>PRIMARY KEY</Tag> : column.unique ? <Tag>UNIQUE</Tag> : null}
                                            {column.notNull ? <Tag>NOT NULL</Tag> : null}
                                            {column.default !== null ? <Tag>DEFAULT {column.default}</Tag> : null}
                                            {fks.map(fk => (
                                                <button
                                                    key={`${fk.table}.${fk.toColumn}`}
                                                    type="button"
                                                    onClick={() => jump(fk.table)}
                                                    className="text-primary inline-flex items-center gap-0.5 rounded border border-current/30 px-1.5 font-mono text-[11px] hover:underline"
                                                >
                                                    <ArrowRightIcon className="size-3" aria-hidden />
                                                    {fk.table}.{fk.toColumn}
                                                </button>
                                            ))}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                        {incoming.length ? (
                            <p className="border-border text-muted-foreground flex flex-wrap items-center gap-1 border-t px-3 py-1.5 text-xs">
                                {t("engineV2.database.schemaReferencedBy")}
                                {incoming.map(fk => (
                                    <button key={`${fk.from}.${fk.column}`} type="button" onClick={() => jump(fk.from)} className="text-primary font-mono hover:underline">
                                        {fk.from}.{fk.column}
                                    </button>
                                ))}
                            </p>
                        ) : null}
                    </section>
                );
            })}
        </div>
    );
}

const Tag = ({ children }: { children: React.ReactNode }) => <span className="bg-muted rounded px-1.5 font-mono text-[11px]">{children}</span>;
