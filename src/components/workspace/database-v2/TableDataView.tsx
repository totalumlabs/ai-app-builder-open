"use client";

import * as React from "react";
import { LoaderIcon, PlusIcon, SearchIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, SpinnerBlock } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";
import { aiFilterQuestion, deleteStatements, inlineSql, isEditable, keyColumns, whereOf, type Statement } from "@/lib/db-v2-form";
import { statementKind } from "@/lib/sql-statement";
import { cn } from "@/lib/utils";
import { vcaasApi } from "@/lib/vcaas";
import type { DbEnv, SqlRows, SqlTable } from "@/lib/vcaas-types";
import { ENV_THEME, envLabel } from "./env-theme";
import { RecordPanel } from "./RecordPanel";
import { ResultGrid } from "./ResultGrid";

const PAGE = 50;

/** A write waiting for the user's yes: every delete, and every write on Live. */
export interface PendingWrite {
    statements: Statement[];
    title: string;
    description?: string;
    confirmLabel: string;
    onDone: () => void;
}

/**
 * Runs row writes through `POST …/database/sql` one statement at a time, with `allowWrites`, and `confirmLive` only
 * after the Live box was ticked — the server refuses a live write beside a dev database without it
 * (`LIVE_WRITE_CONFIRMATION_REQUIRED`), so the confirmation is enforced there, not only here.
 */
export function useRowWriter(projectId: string, env: DbEnv, hasDev: boolean) {
    const t = useT();
    const [pending, setPending] = React.useState<PendingWrite | null>(null);
    const [liveOk, setLiveOk] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const execute = React.useCallback(
        async (write: PendingWrite, confirmLive: boolean): Promise<boolean> => {
            setError(null);
            for (const statement of write.statements) {
                const response = await vcaasApi.v2.sql(projectId, {
                    env,
                    sql: statement.sql,
                    params: statement.params,
                    allowWrites: true,
                    ...(confirmLive ? { confirmLive: true } : {}),
                });
                if (!response.ok) {
                    setError(response.error || t("engineV2.common.failed"));
                    return false;
                }
            }
            write.onDone();
            return true;
        },
        [projectId, env, t],
    );

    /** Dev saves run at once; a delete, or anything on Live, asks first. */
    const write = (next: PendingWrite, ask: boolean) => {
        if (!ask && env === "dev") return execute(next, false);
        setLiveOk(false);
        setPending(next);
        return Promise.resolve(true);
    };

    const needsBox = env === "live" && hasDev;
    const dialog = (
        <ConfirmDialog
            open={!!pending}
            onOpenChange={open => !open && setPending(null)}
            tone="danger"
            title={pending?.title ?? ""}
            description={
                <>
                    {pending?.description ? <span className="block">{pending.description}</span> : null}
                    {env === "live" ? (
                        <span className="mt-2 block rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100" data-testid="editing-live">
                            <strong className="block">{t("engineV2.database.editingLive")}</strong>
                            {hasDev ? t("engineV2.database.liveConfirmBody") : t("engineV2.database.liveOnlyWarning")}
                        </span>
                    ) : null}
                </>
            }
            confirmLabel={pending?.confirmLabel}
            confirmDisabled={needsBox && !liveOk}
            onConfirm={async () => {
                if (pending) await execute(pending, needsBox && liveOk);
                setPending(null);
            }}
        >
            {pending ? (
                <pre className="bg-muted max-h-40 overflow-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap">{pending.statements.map(inlineSql).join(";\n")}</pre>
            ) : null}
            {needsBox ? (
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={liveOk} onChange={event => setLiveOk(event.target.checked)} />
                    {t("engineV2.database.writeLiveBox")}
                </label>
            ) : null}
        </ConfirmDialog>
    );
    return { write, dialog, error, setError };
}

/**
 * One table: search, "Search with AI" (a plain-language filter the AI turns into a WHERE that is shown before it
 * runs), paging, row selection with bulk delete, and the editor panel for a new or clicked row.
 */
export function TableDataView({
    projectId,
    env,
    hasDev,
    table,
    tables,
    onChanged,
    onOpenSql,
}: {
    projectId: string;
    env: DbEnv;
    hasDev: boolean;
    table: SqlTable;
    tables: SqlTable[];
    onChanged: () => void;
    onOpenSql: (sql: string) => void;
}) {
    const t = useT();
    const theme = ENV_THEME[env];
    const editable = isEditable(table);
    const keys = keyColumns(table);
    const [offset, setOffset] = React.useState(0);
    const [sort, setSort] = React.useState<{ column: string; dir: "asc" | "desc" } | null>(null);
    const [search, setSearch] = React.useState("");
    const [query, setQuery] = React.useState("");
    const [result, setResult] = React.useState<SqlRows | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [reload, setReload] = React.useState(0);
    const [selected, setSelected] = React.useState<Set<number>>(new Set());
    const [editing, setEditing] = React.useState<Record<string, unknown> | "new" | null>(null);

    // Search with AI
    const [aiOpen, setAiOpen] = React.useState(false);
    const [aiText, setAiText] = React.useState("");
    const [aiBusy, setAiBusy] = React.useState(false);
    const [aiSql, setAiSql] = React.useState<{ sql: string; where: string | null; credits?: number } | null>(null);
    const [aiApplied, setAiApplied] = React.useState<string | null>(null);

    const writer = useRowWriter(projectId, env, hasDev);

    React.useEffect(() => {
        const timer = window.setTimeout(() => setQuery(search.trim()), 350);
        return () => window.clearTimeout(timer);
    }, [search]);

    React.useEffect(() => {
        let cancelled = false;
        setSelected(new Set());
        const request = aiApplied
            ? vcaasApi.v2.sql(projectId, { env, sql: aiApplied })
            : vcaasApi.v2.rows(projectId, { env, table: table.name, page: { limit: PAGE, offset }, count: true, ...(sort ? { sort: [sort] } : {}), ...(query ? { search: query } : {}) });
        void request.then(response => {
            if (cancelled) return;
            setError(response.ok ? null : response.error || t("engineV2.common.failed"));
            setResult(response.ok ? response.data : null);
        });
        return () => {
            cancelled = true;
        };
    }, [projectId, env, table.name, offset, sort, query, aiApplied, reload, t]);

    const refresh = () => {
        setReload(n => n + 1);
        onChanged();
    };

    const buildAiFilter = async () => {
        setAiBusy(true);
        setAiSql(null);
        const response = await vcaasApi.v2.ask(projectId, { env, question: aiFilterQuestion(table.name, aiText) });
        setAiBusy(false);
        if (!response.ok) {
            return toast.error(response.code === "INSUFFICIENT_CREDITS" ? t("engineV2.database.askNoCredits") : response.error || t("engineV2.common.failed"));
        }
        const sql = response.data.sql;
        const where = response.data.isReadOnly && statementKind(sql) === "select" ? whereOf(sql, table.name) : null;
        setAiSql({ sql, where, credits: response.data.creditsCharged });
    };

    const selectedRows = result ? [...selected].map(index => result.rows[index]).filter(Boolean) : [];
    const deleteRows = (rows: Record<string, unknown>[], after?: () => void) =>
        void writer.write(
            {
                statements: deleteStatements(table.name, keys, rows),
                title: rows.length === 1 ? t("engineV2.database.deleteOneTitle", { table: table.label || table.name }) : t("engineV2.database.deleteManyTitle", { count: rows.length, table: table.label || table.name }),
                description: t("engineV2.database.deleteBody"),
                confirmLabel: rows.length === 1 ? t("engineV2.database.deleteRow") : t("engineV2.database.deleteSelected", { count: rows.length }),
                onDone: () => {
                    toast.success(t("engineV2.database.deleted", { count: rows.length }));
                    after?.();
                    refresh();
                },
            },
            true,
        );

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-1 text-sm font-semibold">{table.label || table.name}</h3>
                {typeof result?.total === "number" && !aiApplied ? <span className="text-muted-foreground text-xs">{t("engineV2.database.rowsTotal", { count: result.total })}</span> : null}
                <div className="relative ml-auto">
                    <SearchIcon className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden />
                    <Input
                        className="h-8 w-56 pl-7"
                        placeholder={t("engineV2.database.search")}
                        aria-label={t("engineV2.database.search")}
                        value={search}
                        disabled={!!aiApplied}
                        onChange={e => {
                            setSearch(e.target.value);
                            setOffset(0);
                        }}
                    />
                </div>
                <Button size="sm" variant={aiOpen ? "secondary" : "outline"} className="h-8" onClick={() => setAiOpen(open => !open)} aria-expanded={aiOpen}>
                    <SparklesIcon className="size-3.5" aria-hidden />
                    {t("engineV2.database.searchAi")}
                </Button>
                {editable ? (
                    <Button size="sm" className={cn("h-8", theme.button)} onClick={() => setEditing("new")}>
                        <PlusIcon className="size-3.5" aria-hidden />
                        {t("engineV2.database.newRow")}
                    </Button>
                ) : null}
            </div>

            {!editable ? (
                <p className="text-muted-foreground text-xs">{table.kind === "system" ? t("engineV2.database.readOnlyTable") : t("engineV2.database.noKeyTable")}</p>
            ) : null}

            {aiOpen ? (
                <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-3" data-testid="ai-search">
                    <div className="flex flex-wrap gap-2">
                        <Input
                            className="h-8 min-w-64 flex-1"
                            value={aiText}
                            onChange={event => setAiText(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === "Enter" && aiText.trim()) void buildAiFilter();
                            }}
                            placeholder={t("engineV2.database.searchAiPlaceholder")}
                            aria-label={t("engineV2.database.searchAi")}
                        />
                        <Button size="sm" className="h-8" disabled={aiBusy || !aiText.trim()} onClick={() => void buildAiFilter()}>
                            {aiBusy ? <LoaderIcon className="size-3.5 animate-spin" aria-hidden /> : <SparklesIcon className="size-3.5" aria-hidden />}
                            {t("engineV2.database.searchAiBuild")}
                        </Button>
                    </div>
                    <p className="text-muted-foreground text-xs">{t("engineV2.database.aiCredits")}</p>
                    {aiSql ? (
                        <div className="space-y-2">
                            {aiSql.where ? (
                                <>
                                    <p className="text-xs font-medium">{t("engineV2.database.aiFilterShown")}</p>
                                    <pre className="bg-background border-border rounded border p-2 font-mono text-xs whitespace-pre-wrap">
                                        <span className="text-muted-foreground">WHERE </span>
                                        {aiSql.where}
                                    </pre>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs">{t("engineV2.database.aiFilterNotFilter")}</p>
                                    <pre className="bg-background border-border rounded border p-2 font-mono text-xs whitespace-pre-wrap">{aiSql.sql}</pre>
                                </>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                                {aiSql.where ? (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setAiApplied(aiSql.sql);
                                            setOffset(0);
                                        }}
                                    >
                                        {t("engineV2.database.aiFilterApply")}
                                    </Button>
                                ) : null}
                                <Button size="sm" variant="outline" onClick={() => onOpenSql(aiSql.sql)}>
                                    {t("engineV2.database.openInSql")}
                                </Button>
                                {typeof aiSql.credits === "number" ? <span className="text-muted-foreground text-xs">{t("engineV2.database.charged", { credits: aiSql.credits })}</span> : null}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {aiApplied ? (
                <div className={cn("flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-xs", theme.banner)}>
                    <SparklesIcon className="size-3.5" aria-hidden />
                    <span className="font-medium">{t("engineV2.database.aiFilterActive")}</span>
                    <code className="min-w-0 flex-1 truncate font-mono">{whereOf(aiApplied, table.name)}</code>
                    <Button size="sm" variant="ghost" className="h-6" onClick={() => setAiApplied(null)}>
                        <XIcon className="size-3" aria-hidden />
                        {t("engineV2.database.aiFilterClear")}
                    </Button>
                </div>
            ) : null}

            {selected.size > 0 ? (
                <div className="border-destructive/30 bg-destructive-subtle flex items-center gap-2 rounded-md border px-2 py-1 text-xs" data-testid="bulk-bar">
                    <span className="font-medium">{t("engineV2.database.selected", { count: selected.size })}</span>
                    <Button size="sm" variant="destructive" className="h-7" onClick={() => deleteRows(selectedRows)}>
                        <Trash2Icon className="size-3.5" aria-hidden />
                        {t("engineV2.database.deleteSelected", { count: selected.size })}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelected(new Set())}>
                        {t("engineV2.database.clearSelection")}
                    </Button>
                </div>
            ) : null}

            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            {writer.error ? <pre className="text-destructive bg-destructive-subtle rounded p-2 font-mono text-xs whitespace-pre-wrap">{writer.error}</pre> : null}
            {result ? (
                <ResultGrid
                    result={result}
                    csvName={`${projectId}-${table.name}-${env}`}
                    sort={aiApplied ? undefined : sort}
                    onSort={aiApplied ? undefined : column => setSort(current => ({ column, dir: current?.column === column && current.dir === "asc" ? "desc" : "asc" }))}
                    selection={editable ? { selected, onChange: setSelected } : undefined}
                    onRowClick={editable ? index => setEditing(result.rows[index]) : undefined}
                />
            ) : !error ? (
                <SpinnerBlock />
            ) : null}
            {!aiApplied ? (
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                        {t("engineV2.database.previous")}
                    </Button>
                    <Button size="sm" variant="outline" disabled={!result || result.rows.length < PAGE || offset + PAGE > 10_000} onClick={() => setOffset(offset + PAGE)}>
                        {t("engineV2.database.next")}
                    </Button>
                    <span className="text-muted-foreground ml-auto text-xs">{t("engineV2.database.editHint", { env: envLabel(env) })}</span>
                </div>
            ) : null}

            {editing ? (
                <RecordPanel
                    projectId={projectId}
                    env={env}
                    table={table}
                    tables={tables}
                    row={editing === "new" ? null : editing}
                    sample={result?.rows[0]}
                    writer={writer}
                    onClose={() => setEditing(null)}
                    onSaved={refresh}
                    onDelete={row => deleteRows([row], () => setEditing(null))}
                />
            ) : null}
            {writer.dialog}
        </div>
    );
}
