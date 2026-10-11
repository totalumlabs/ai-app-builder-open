"use client";

import * as React from "react";
import { DatabaseIcon, RefreshCwIcon, TableIcon } from "lucide-react";
import { EmptyState, SpinnerBlock } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { vcaasApi } from "@/lib/vcaas";
import type { DbEnv, SqlSchema, SqlTable, VcaasProject } from "@/lib/vcaas-types";
import { BackupsPanel } from "./BackupsPanel";
import { DatabaseSettingsPanel } from "./DatabaseSettingsPanel";
import { ENV_THEME, envLabel } from "./env-theme";
import { MigrationsPanel } from "./MigrationsPanel";
import { RawSqlPanel } from "./SqlPanels";
import { TableDataView } from "./TableDataView";
import { FILES_CHANGED_EVENT } from "@/lib/file-save";
import { isAppTable } from "@/lib/db-v2-form";
import { SchemasView } from "./SchemasView";

type View = "data" | "schema" | "sql" | "migrations" | "backups" | "settings";
const VIEWS: View[] = ["data", "schema", "sql", "migrations", "backups", "settings"];


function envKey(projectId: string) {
    return `totalum:database:env:${projectId}`;
}

/**
 * The v2 database explorer (A7.12, plan 15 §4.1) — a SECOND component chosen by the engine at
 * the Database tab; the legacy `DatabasePanel` is untouched. It reads the PRAGMA-derived schema,
 * pages rows, runs raw SQL and plain-language questions, and lists migrations, all in the
 * environment of one shared Dev/Live switch (Dev orange, Live green: a subtle tint on the frame and banner).
 * Rows are created, edited and deleted in `TableDataView` through the server's SQL guard. Schema
 * changes are never made here: they are migrations the agent (or `npm run db:migrate`) applies.
 */
export function SqlDatabasePanel({ project }: { project: VcaasProject }) {
    const t = useT();
    const projectId = project.projectId;
    const [env, setEnv] = React.useState<DbEnv | null>(null);
    const [schema, setSchema] = React.useState<SqlSchema | null>(null);
    const [schemaError, setSchemaError] = React.useState<{ message: string; bug: boolean } | null>(null);
    const [table, setTable] = React.useState<string | null>(null);
    const [view, setView] = React.useState<View>("data");
    const [handover, setHandover] = React.useState<string | undefined>(undefined);
    // Learnt from the dev schema call: a project without a dev database answers 404 DEV_DATABASE_NOT_FOUND.
    const [hasDev, setHasDev] = React.useState<boolean | null>(null);
    // E1: whether the sign-in `users` table has a row in this database (one row read; the schema carries no counts)
    const [usersHaveRows, setUsersHaveRows] = React.useState(false);

    // Default: what the preview shows — dev when it exists (A3.9) — remembered per project.
    React.useEffect(() => {
        let remembered: DbEnv | null = null;
        try {
            remembered = window.localStorage.getItem(envKey(projectId)) as DbEnv | null;
        } catch {
            /* ignore */
        }
        setEnv(remembered === "live" ? "live" : "dev");
    }, [projectId]);

    const load = React.useCallback(async () => {
        if (!env) return;
        setSchemaError(null);
        const [response, dev, usersRow] = await Promise.all([
            vcaasApi.v2.schema(projectId, env),
            env === "live" && hasDev === null ? vcaasApi.v2.schema(projectId, "dev") : null,
            vcaasApi.v2.rows(projectId, { env, table: "users", page: { limit: 1 } }),
        ]);
        if (dev) setHasDev(dev.ok);
        if (!response.ok) {
            // No dev database: the switch shows Live only and a remembered `dev` falls back.
            if (env === "dev" && response.upstreamCode === "DEV_DATABASE_NOT_FOUND") {
                setHasDev(false);
                return setEnv("live");
            }
            // PROJECT_ENGINE_MISMATCH is unreachable from an engine-selected explorer: a bug, not a user error.
            return setSchemaError({ message: response.error || t("engineV2.common.failed"), bug: response.upstreamCode === "PROJECT_ENGINE_MISMATCH" });
        }
        if (env === "dev") setHasDev(true);
        const data = response.data!;
        const users = usersRow.ok && (usersRow.data?.rows.length ?? 0) > 0;
        setUsersHaveRows(users);
        setSchema(data);
        setTable(current => (current && data.tables.some(t2 => t2.name === current) ? current : data.tables.find(t2 => isAppTable(t2, users))?.name ?? null));
    }, [projectId, env, hasDev, t]);

    React.useEffect(() => {
        void load();
    }, [load]);

    // SP16: a run (or a restore) may have applied migrations — the header's count and the schema are read again
    React.useEffect(() => {
        const onChanged = (event: Event) => {
            if ((event as CustomEvent<string>).detail === projectId) void load();
        };
        window.addEventListener(FILES_CHANGED_EVENT, onChanged);
        return () => window.removeEventListener(FILES_CHANGED_EVENT, onChanged);
    }, [projectId, load]);

    const chooseEnv = (next: DbEnv) => {
        // Re-pressing the selected database must not blank the schema: the load effect would never run again.
        if (next === env) return;
        try {
            window.localStorage.setItem(envKey(projectId), next);
        } catch {
            /* ignore */
        }
        setSchema(null);
        setEnv(next);
    };

    if (schemaError) {
        return (
            <EmptyState
                variant="panel"
                icon={<DatabaseIcon />}
                title={schemaError.bug ? t("engineV2.database.bugTitle") : t("engineV2.common.failed")}
                description={schemaError.bug ? t("engineV2.database.bugBody") : schemaError.message}
                actions={<Button onClick={() => (schemaError.bug ? window.location.reload() : void load())}>{t("common.retry")}</Button>}
            />
        );
    }
    if (!schema || !env) return <SpinnerBlock />;

    const selected = schema.tables.find(item => item.name === table) ?? null;
    const theme = ENV_THEME[env];
    const isVisible = (item: SqlTable) => isAppTable(item, usersHaveRows);
    const appTables = schema.tables.filter(isVisible);
    const systemTables = schema.tables.filter(item => !isVisible(item));
    const tableButton = (item: SqlTable) => (
        <button
            key={item.name}
            type="button"
            onClick={() => setTable(item.name)}
            aria-current={item.name === table ? "true" : undefined}
            className={cn(
                "hover:bg-muted flex w-full items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-left text-sm",
                item.name === table && cn("font-medium", theme.soft, theme.accent),
                !isVisible(item) && "text-muted-foreground",
            )}
        >
            <TableIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{item.label || item.name}</span>
            {item.rowCount !== undefined ? <span className="text-muted-foreground text-xs tabular-nums">{item.rowCount}</span> : null}
        </button>
    );

    return (
        <div data-db-env={env} className={cn("flex h-full min-h-0 flex-col border", theme.frame)}>
            <div className="border-border flex flex-wrap items-center gap-2 border-b px-3 py-2">
                <div role="group" aria-label={t("engineV2.database.envSwitch")} className="bg-muted flex rounded-lg p-0.5">
                    {(hasDev ? (["dev", "live"] as const) : (["live"] as const)).map(value => (
                        // The selected database must be obvious (a write on Live reaches real users): its own colour, filled.
                        <Button
                            key={value}
                            size="sm"
                            variant="ghost"
                            aria-pressed={env === value}
                            className={cn("h-7 gap-1.5 px-3 font-semibold", env === value ? ENV_THEME[value].selected : "text-muted-foreground")}
                            onClick={() => chooseEnv(value)}
                        >
                            <span className={cn("size-2 rounded-full", ENV_THEME[value].dot)} aria-hidden />
                            {envLabel(value)}
                        </Button>
                    ))}
                </div>
                <nav className="flex flex-wrap items-center gap-0.5" aria-label={t("engineV2.database.views")}>
                    {VIEWS.map(value => (
                        <Button
                            key={value}
                            size="sm"
                            variant="ghost"
                            aria-pressed={view === value}
                            className={cn("h-7 rounded-none border-b-2 border-transparent px-2.5", view === value ? cn("font-semibold", theme.accent) : "text-muted-foreground")}
                            onClick={() => setView(value)}
                        >
                            {t(`engineV2.database.view_${value}`)}
                        </Button>
                    ))}
                </nav>
                <span className="text-muted-foreground ml-auto text-xs">{t("engineV2.database.applied", { count: schema.ledger?.count ?? 0 })}</span>
                <Button size="icon" variant="ghost" className="size-7" aria-label={t("common.retry")} onClick={() => void load()}>
                    <RefreshCwIcon className="size-3.5" aria-hidden />
                </Button>
            </div>
            <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b px-3 py-1.5 text-xs", theme.banner)} data-testid="db-env-banner">
                <span className={cn("size-2 shrink-0 rounded-full", theme.dot)} aria-hidden />
                <span className="font-semibold">{t(env === "dev" ? "engineV2.database.bannerDev" : hasDev ? "engineV2.database.bannerLive" : "engineV2.database.bannerLiveOnly")}</span>
                <span className="opacity-80">{hasDev ? t("engineV2.database.caseDevLive") : t("engineV2.database.caseLiveOnly")}</span>
            </div>

            <div className="flex min-h-0 flex-1">
                {view === "data" ? (
                    <aside className="border-border w-56 shrink-0 overflow-y-auto border-r p-2" aria-labelledby="db-tables-title">
                        <h2 id="db-tables-title" className="text-muted-foreground flex items-center gap-1.5 px-2 pt-1 pb-2 text-xs font-semibold tracking-wide uppercase">
                            <DatabaseIcon className="size-3.5" aria-hidden />
                            {t("engineV2.database.tablesTitle")}
                            <span className="ml-auto font-normal tabular-nums">{appTables.length}</span>
                        </h2>
                        <div className="space-y-0.5">{appTables.map(tableButton)}</div>
                        {appTables.length === 0 ? <p className="text-muted-foreground p-2 text-xs">{t("engineV2.database.noTables")}</p> : null}
                        {systemTables.length ? (
                            <details className="mt-3">
                                <summary className="text-muted-foreground cursor-pointer px-2 py-1 text-xs font-medium">
                                    {t("engineV2.database.systemTables", { count: systemTables.length })}
                                </summary>
                                <p className="text-muted-foreground px-2 pb-1 text-[11px]">{t("engineV2.database.systemTablesHint")}</p>
                                <div className="space-y-0.5">{systemTables.map(tableButton)}</div>
                            </details>
                        ) : null}
                    </aside>
                ) : null}
                <div className="min-w-0 flex-1 overflow-auto p-3">
                    {view === "data" && selected ? (
                        <TableDataView key={`${env}-${selected.name}`} projectId={projectId} env={env} hasDev={hasDev === true} table={selected} tables={schema.tables}
                            onChanged={() => void load()}
                            onOpenSql={sql => {
                                setHandover(sql);
                                setView("sql");
                            }}
                        />
                    ) : null}
                    {view === "schema" ? (
                        <SchemasView
                            tables={schema.tables}
                            usersHaveRows={usersHaveRows}
                            onOpenTable={name => {
                                setTable(name);
                                setView("data");
                            }}
                        />
                    ) : null}
                    {view === "sql" ? <RawSqlPanel projectId={projectId} env={env} hasDev={hasDev === true} seed={handover} /> : null}
                    {view === "migrations" ? <MigrationsPanel projectId={projectId} env={env} /> : null}
                    {view === "backups" ? <BackupsPanel key={env} projectId={projectId} env={env} /> : null}
                    {view === "settings" ? <DatabaseSettingsPanel projectId={projectId} env={env} /> : null}
                </div>
            </div>
        </div>
    );
}
