"use client";

import * as React from "react";
import { ChevronRightIcon, FileCodeIcon } from "lucide-react";
import { SpinnerBlock, StatusPill } from "@/components/primitives";
import { useT } from "@/i18n";
import { joinMigrations, migrationName, migrationSummary, type JournalEntry, type MigrationItem } from "@/lib/db-v2-form";
import { vcaasApi } from "@/lib/vcaas";
import type { DbEnv } from "@/lib/vcaas-types";
import { UndoDbChange } from "../v2/UndoDbChange";
import { envLabel } from "./env-theme";

const JOURNAL = "drizzle/meta/_journal.json";

/**
 * The migrations of one database, by name: the code's Drizzle journal (tag = file name) joined with the database's
 * `_migrations` ledger (hash + the journal's `when`). Click one to read its SQL file. The ledger stores no apply time,
 * so the date shown is when the migration was generated.
 */
export function MigrationsPanel({ projectId, env }: { projectId: string; env: DbEnv }) {
    const t = useT();
    const [items, setItems] = React.useState<MigrationItem[] | null | undefined>(undefined);
    const [open, setOpen] = React.useState<string | null>(null);
    const [sql, setSql] = React.useState<Record<string, string | null>>({});

    React.useEffect(() => {
        let cancelled = false;
        void Promise.all([
            vcaasApi.v2.rows(projectId, { env, table: "_migrations", page: { limit: 200 } }),
            vcaasApi.files.content(projectId, JOURNAL),
        ]).then(([ledger, journal]) => {
            if (cancelled) return;
            if (!ledger.ok) return setItems(null);
            let entries: JournalEntry[] = [];
            try {
                entries = journal.ok ? (JSON.parse(journal.data.content).entries ?? []) : [];
            } catch {
                /* a broken journal still shows the ledger */
            }
            setItems(joinMigrations(entries, ledger.data.rows as { hash: unknown; created_at: unknown }[]));
        });
        return () => {
            cancelled = true;
        };
    }, [projectId, env]);

    // The SQL files are small; read them all once so every row can say what it does.
    React.useEffect(() => {
        for (const item of items ?? []) {
            if (!item.tag || item.tag in sql) continue;
            const tag = item.tag;
            setSql(current => ({ ...current, [tag]: current[tag] ?? null }));
            void vcaasApi.files.content(projectId, `drizzle/${tag}.sql`).then(response => setSql(current => ({ ...current, [tag]: response.ok ? response.data.content : "" })));
        }
    }, [items, projectId, sql]);

    if (items === undefined) return <SpinnerBlock />;
    if (items === null) return <p className="text-muted-foreground text-xs">{t("engineV2.common.unavailable")}</p>;

    const summary = (text: string | null | undefined) => {
        if (!text) return null;
        const s = migrationSummary(text);
        return [
            s.created.length ? t("engineV2.database.migCreates", { tables: s.created.join(", ") }) : null,
            s.altered.length ? t("engineV2.database.migAlters", { tables: s.altered.join(", ") }) : null,
            s.dropped.length ? t("engineV2.database.migDrops", { tables: s.dropped.join(", ") }) : null,
            s.indexes === 1 ? t("engineV2.database.migIndexOne") : s.indexes ? t("engineV2.database.migIndexes", { count: s.indexes }) : null,
        ]
            .filter(Boolean)
            .join(" · ");
    };

    return (
        <div className="space-y-3 text-sm">
            <UndoDbChange projectId={projectId} />
            <ul className="space-y-1.5" data-testid="migrations">
                {items.map(item => {
                    const key = item.tag ?? item.hash ?? String(item.when);
                    const name = item.tag ? migrationName(item.tag) : null;
                    const text = item.tag ? sql[item.tag] : undefined;
                    const expanded = open === key;
                    return (
                        <li key={key} className="border-border rounded-lg border">
                            <button type="button" className="hover:bg-muted/60 flex w-full items-start gap-3 px-3 py-2 text-left" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : key)}>
                                <ChevronRightIcon className={`mt-0.5 size-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden />
                                <span className="text-muted-foreground mt-0.5 font-mono text-xs tabular-nums">{name?.number || "—"}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium">{name ? name.title : t("engineV2.database.migUnknown")}</span>
                                    <span className="text-muted-foreground block text-xs">{summary(text) || (item.tag ?? item.hash)}</span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-1">
                                    <StatusPill tone={item.applied ? "success" : "warning"}>
                                        {item.applied ? t("engineV2.database.migApplied", { env: envLabel(env) }) : t("engineV2.database.migPending", { env: envLabel(env) })}
                                    </StatusPill>
                                    <span className="text-muted-foreground text-[11px]">{t("engineV2.database.migCreated", { date: new Date(item.when).toLocaleString() })}</span>
                                </span>
                            </button>
                            {expanded ? (
                                <div className="border-border space-y-1 border-t px-3 py-2">
                                    <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px]">
                                        <FileCodeIcon className="size-3.5" aria-hidden />
                                        {item.tag ? `drizzle/${item.tag}.sql` : item.hash}
                                    </p>
                                    {text === null ? (
                                        <SpinnerBlock />
                                    ) : text ? (
                                        <pre className="bg-muted max-h-80 overflow-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap" data-testid="migration-sql">
                                            {text.replace(/--> statement-breakpoint\n?/g, "")}
                                        </pre>
                                    ) : (
                                        <p className="text-muted-foreground text-xs">{t("engineV2.database.migSqlUnavailable")}</p>
                                    )}
                                </div>
                            ) : null}
                        </li>
                    );
                })}
                {items.length === 0 ? <li className="text-muted-foreground text-xs">{t("engineV2.database.noMigrations")}</li> : null}
            </ul>
            <p className="text-muted-foreground text-xs">{t("engineV2.database.schemaHint")}</p>
        </div>
    );
}
