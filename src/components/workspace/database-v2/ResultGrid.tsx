"use client";

import * as React from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { toCsv } from "@/lib/sql-statement";
import type { SqlRows } from "@/lib/vcaas-types";

function cell(value: unknown): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function Cell({ value }: { value: unknown }) {
    if (value === null || value === undefined) return <span className="text-muted-foreground/70 italic">NULL</span>;
    return <>{cell(value)}</>;
}

/**
 * Rows grid shared by the Data and SQL views: timing, counts, the 1,000-row notice, CSV. With `selection` the Data
 * view gets a checkbox column (bulk delete) and a click on a row opens it in the editor.
 */
export function ResultGrid({
    result,
    csvName,
    onSort,
    sort,
    selection,
    onRowClick,
}: {
    result: SqlRows;
    csvName: string;
    onSort?: (column: string) => void;
    sort?: { column: string; dir: "asc" | "desc" } | null;
    selection?: { selected: Set<number>; onChange: (next: Set<number>) => void };
    onRowClick?: (index: number) => void;
}) {
    const t = useT();
    const columns = result.columns.map(column => column.name);

    const exportCsv = () => {
        const blob = new Blob([toCsv(columns, result.rows)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${csvName}-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-2">
            {result.truncated ? <p className="text-warning text-xs font-medium">{t("engineV2.database.truncated")}</p> : null}
            <div className="border-border max-h-[55vh] overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0 text-left">
                        <tr>
                            {selection ? (
                                <th className="w-8 px-2 py-1.5">
                                    <input
                                        type="checkbox"
                                        aria-label={t("engineV2.database.selectAll")}
                                        checked={result.rows.length > 0 && selection.selected.size === result.rows.length}
                                        onChange={event => selection.onChange(new Set(event.target.checked ? result.rows.map((_, i) => i) : []))}
                                    />
                                </th>
                            ) : null}
                            {columns.map(column => (
                                <th key={column} className="px-2 py-1.5 font-medium whitespace-nowrap">
                                    {onSort ? (
                                        <button type="button" onClick={() => onSort(column)} className="hover:underline">
                                            {column}
                                            {sort?.column === column ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                                        </button>
                                    ) : (
                                        column
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {result.rows.map((row, index) => (
                            <tr
                                key={index}
                                className={`border-border border-t ${onRowClick ? "hover:bg-muted/60 cursor-pointer" : ""} ${selection?.selected.has(index) ? "bg-muted" : ""}`}
                                onClick={onRowClick ? () => onRowClick(index) : undefined}
                            >
                                {selection ? (
                                    <td className="px-2 py-1" onClick={event => event.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            aria-label={t("engineV2.database.selectRow")}
                                            checked={selection.selected.has(index)}
                                            onChange={event => {
                                                const next = new Set(selection.selected);
                                                if (event.target.checked) next.add(index);
                                                else next.delete(index);
                                                selection.onChange(next);
                                            }}
                                        />
                                    </td>
                                ) : null}
                                {columns.map(column => (
                                    <td key={column} className="max-w-72 truncate px-2 py-1 font-mono" title={cell(row[column])}>
                                        <Cell value={row[column]} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                <span>{t("engineV2.database.rowsShown", { count: result.rows.length })}</span>
                {typeof result.total === "number" ? <span>{t("engineV2.database.rowsTotal", { count: result.total })}</span> : null}
                {result.meta ? (
                    <span>
                        {t("engineV2.database.meta", {
                            ms: Math.round(result.meta.duration ?? 0),
                            read: result.meta.rows_read ?? 0,
                            written: result.meta.rows_written ?? 0,
                        })}
                    </span>
                ) : null}
                {result.rows.length > 0 ? (
                    <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={exportCsv}>
                        <DownloadIcon className="size-3.5" aria-hidden />
                        CSV
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
