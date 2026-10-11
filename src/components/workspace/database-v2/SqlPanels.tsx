"use client";

import * as React from "react";
import { LoaderIcon, PlayIcon, SparklesIcon } from "lucide-react";
import { ConfirmDialog, StatusPill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";
import { splitStatements, statementKind } from "@/lib/sql-statement";
import { vcaasApi } from "@/lib/vcaas";
import type { DbEnv, SqlAskResult, SqlRows } from "@/lib/vcaas-types";
import { ResultGrid } from "./ResultGrid";

const HISTORY_MAX = 20;
interface HistoryEntry {
    sql: string;
    env: DbEnv;
    at: string;
    ok: boolean;
}

function historyKey(projectId: string) {
    return `totalum:database:sql-history:${projectId}`;
}
function readHistory(projectId: string): HistoryEntry[] {
    try {
        return JSON.parse(window.localStorage.getItem(historyKey(projectId)) || "[]");
    } catch {
        return [];
    }
}
function pushHistory(projectId: string, entry: HistoryEntry): HistoryEntry[] {
    const next = [entry, ...readHistory(projectId).filter(e => e.sql !== entry.sql || e.env !== entry.env)].slice(0, HISTORY_MAX);
    try {
        window.localStorage.setItem(historyKey(projectId), JSON.stringify(next));
    } catch {
        /* history unavailable — the panel still works */
    }
    return next;
}

/**
 * Raw SQL (A7.12, plan 15 §4.1.5): one statement per call, in the toolbar's environment.
 * Reads run at once; writes never run on the first click (confirmation, and on a live DB that
 * has a dev copy the explicit "write to live" box → `confirmLive`); DDL is refused inline —
 * schema changes go through a migration. Errors are the verbatim SQLite message.
 *
 * "Write in plain language" (A7.12, plan 15 §4.1.6) asks `database/ask` for the SQL and puts it in the editor: it is
 * SHOWN, never run, until the user presses Run — and then the same write guard applies. Charged in credits.
 */
export function RawSqlPanel({ projectId, env, hasDev, seed }: { projectId: string; env: DbEnv; hasDev: boolean; seed?: string }) {
    const t = useT();
    const [sql, setSql] = React.useState(seed ?? "");
    const [result, setResult] = React.useState<SqlRows | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [running, setRunning] = React.useState(false);
    const [confirming, setConfirming] = React.useState(false);
    const [liveOk, setLiveOk] = React.useState(false);
    const [history, setHistory] = React.useState<HistoryEntry[]>([]);
    const [mode, setMode] = React.useState<"sql" | "plain">("sql");
    const [question, setQuestion] = React.useState("");
    const [asking, setAsking] = React.useState(false);
    const [answer, setAnswer] = React.useState<SqlAskResult | null>(null);

    React.useEffect(() => setHistory(readHistory(projectId)), [projectId]);
    React.useEffect(() => {
        if (seed) setSql(seed);
    }, [seed]);

    const statements = splitStatements(sql);
    const kinds = statements.map(statementKind);
    const hasWrite = kinds.includes("write");
    const needsLiveBox = hasWrite && env === "live" && hasDev;

    const execute = async (allowWrites: boolean) => {
        setRunning(true);
        setError(null);
        setResult(null); // SP10: never the previous statement's rows under this one's error
        let last: SqlRows | null = null;
        for (const statement of statements) {
            const response = await vcaasApi.v2.sql(projectId, {
                env,
                sql: statement,
                ...(allowWrites ? { allowWrites: true } : {}),
                ...(allowWrites && liveOk ? { confirmLive: true } : {}),
            });
            if (!response.ok) {
                setRunning(false);
                setHistory(
                    pushHistory(projectId, {
                        sql,
                        env,
                        at: new Date().toISOString(),
                        ok: false,
                    }),
                );
                return setError(response.upstreamCode === "DDL_NOT_ALLOWED" ? t("engineV2.database.ddlRefused") : response.error || t("engineV2.common.failed"));
            }
            last = response.data;
        }
        setRunning(false);
        setResult(last);
        setHistory(
            pushHistory(projectId, {
                sql,
                env,
                at: new Date().toISOString(),
                ok: true,
            }),
        );
    };

    const ask = async () => {
        setAsking(true);
        setError(null);
        const response = await vcaasApi.v2.ask(projectId, {
            env,
            question: question.trim(),
        });
        setAsking(false);
        if (!response.ok) {
            return setError(response.code === "INSUFFICIENT_CREDITS" ? t("engineV2.database.askNoCredits") : response.error || t("engineV2.common.failed"));
        }
        setAnswer(response.data);
        setSql(response.data.sql);
        setResult(null);
        setMode("sql");
    };

    const run = () => {
        if (!statements.length) return;
        if (kinds.includes("ddl")) {
            setResult(null);
            return setError(t("engineV2.database.ddlRefused"));
        }
        if (hasWrite) {
            setLiveOk(false);
            return setConfirming(true);
        }
        void execute(false);
    };

    return (
        <div className="space-y-3">
            <div className="bg-muted inline-flex rounded-lg p-0.5" role="group" aria-label={t("engineV2.database.sqlMode")}>
                {(["sql", "plain"] as const).map(value => (
                    <Button
                        key={value}
                        size="sm"
                        variant="ghost"
                        aria-pressed={mode === value}
                        className={`h-7 ${mode === value ? "bg-background text-foreground hover:bg-background shadow-sm" : "text-muted-foreground"}`}
                        onClick={() => setMode(value)}
                    >
                        {value === "plain" ? <SparklesIcon className="size-3.5" aria-hidden /> : null}
                        {value === "sql" ? t("engineV2.database.writeSql") : t("engineV2.database.plainLanguage")}
                    </Button>
                ))}
            </div>
            {mode === "plain" ? (
                <div className="space-y-2" data-testid="plain-language">
                    <Textarea
                        value={question}
                        onChange={event => setQuestion(event.target.value)}
                        onKeyDown={event => {
                            if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && question.trim()) {
                                event.preventDefault();
                                void ask();
                            }
                        }}
                        rows={3}
                        placeholder={t("engineV2.database.askPlaceholder")}
                        aria-label={t("engineV2.database.plainLanguage")}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => void ask()} disabled={asking || !question.trim()}>
                            {asking ? <LoaderIcon className="size-3.5 animate-spin" aria-hidden /> : <SparklesIcon className="size-3.5" aria-hidden />}
                            {t("engineV2.database.askGenerate")}
                        </Button>
                        <span className="text-muted-foreground text-xs">{t("engineV2.database.aiCredits")}</span>
                    </div>
                    {error ? <pre className="text-destructive bg-destructive-subtle rounded p-2 font-mono text-xs whitespace-pre-wrap">{error}</pre> : null}
                </div>
            ) : null}
            {mode === "sql" && answer ? (
                <div className="border-border bg-muted/40 flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs" data-testid="ask-answer">
                    <SparklesIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">{answer.explanation || t("engineV2.database.askToEditor")}</span>
                    <StatusPill tone={answer.isReadOnly ? "success" : "warning"}>{answer.isReadOnly ? t("engineV2.database.readOnly") : t("engineV2.database.changesData")}</StatusPill>
                    {typeof answer.creditsCharged === "number" ? (
                        <span className="text-muted-foreground">
                            {t("engineV2.database.charged", {
                                credits: answer.creditsCharged,
                            })}
                        </span>
                    ) : null}
                </div>
            ) : null}
            {mode === "sql" ? (
                <>
                    <Textarea
                        value={sql}
                        onChange={event => setSql(event.target.value)}
                        onKeyDown={event => {
                            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                event.preventDefault();
                                run();
                            }
                        }}
                        rows={6}
                        spellCheck={false}
                        className="font-mono text-xs"
                        placeholder="SELECT * FROM …"
                        aria-label={t("engineV2.database.sql")}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={run} disabled={running || !statements.length}>
                            {running ? <LoaderIcon className="size-3.5 animate-spin" aria-hidden /> : <PlayIcon className="size-3.5" aria-hidden />}
                            {t("engineV2.database.run")}
                        </Button>
                        <span className="text-muted-foreground text-xs">{t("engineV2.database.sqlBilling")}</span>
                    </div>
                    {error ? <pre className="text-destructive bg-destructive-subtle rounded p-2 font-mono text-xs whitespace-pre-wrap">{error}</pre> : null}
                    {result ? <ResultGrid result={result} csvName={`${projectId}-query-${env}`} /> : null}
                </>
            ) : null}
            {history.length ? (
                <details className="text-xs">
                    <summary className="text-muted-foreground cursor-pointer">{t("engineV2.database.history")}</summary>
                    <ul className="mt-1 space-y-1">
                        {history.map(entry => (
                            <li key={`${entry.env}-${entry.at}`}>
                                <button type="button" className="hover:bg-muted w-full truncate rounded px-1 text-left font-mono" onClick={() => setSql(entry.sql)}>
                                    <StatusPill tone={entry.ok ? "neutral" : "danger"} className="mr-1">
                                        {entry.env}
                                    </StatusPill>
                                    {entry.sql}
                                </button>
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                tone="danger"
                title={t("engineV2.database.writeTitle", {
                    env: env === "live" ? "Live" : "Dev",
                })}
                description={env === "live" && !hasDev ? t("engineV2.database.liveOnlyWarning") : t("engineV2.database.writeBody")}
                confirmLabel={t("engineV2.database.run")}
                confirmDisabled={needsLiveBox && !liveOk}
                onConfirm={() => execute(true)}
            >
                {needsLiveBox ? (
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={liveOk} onChange={event => setLiveOk(event.target.checked)} />
                        {t("engineV2.database.writeLiveBox")}
                    </label>
                ) : null}
            </ConfirmDialog>
        </div>
    );
}
