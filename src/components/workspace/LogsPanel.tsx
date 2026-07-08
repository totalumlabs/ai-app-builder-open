"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RefreshCw, Terminal, Loader2, Code2, Rocket } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface LogsPanelProps {
  projectId: string;
}

type LogEnv = "development" | "production";

export function LogsPanel({ projectId }: LogsPanelProps) {
  const { t } = useI18n();
  // Logs cached per environment so switching tabs keeps what was already loaded.
  const [logs, setLogs] = useState<Record<LogEnv, string>>({ development: "", production: "" });
  const [fetched, setFetched] = useState<Record<LogEnv, boolean>>({ development: false, production: false });
  const [env, setEnv] = useState<LogEnv>("development");
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async (target: LogEnv) => {
    setLoading(true);
    // Dev logs: /backend/dev/logs — Prod logs: /backend/prod/logs (sibling endpoint)
    const segment = target === "development" ? "dev" : "prod";
    console.log(`[Logs] Fetching ${target} logs for:`, projectId);
    const res = await api.get<{ logs: string }>(
      `/api/vcaas/projects/${projectId}/backend/${segment}/logs`
    );
    const text = res.ok && res.data ? (res.data.logs || t("noLogs")) : t("logsFailed");
    if (!res.ok) console.error(`[Logs] Failed to fetch ${target} logs:`, res.error);
    setLogs((prev) => ({ ...prev, [target]: text }));
    setFetched((prev) => ({ ...prev, [target]: true }));
    setLoading(false);
  }, [projectId, t]);

  const switchEnv = (next: LogEnv) => {
    if (next === env) return;
    setEnv(next);
    if (!fetched[next]) fetchLogs(next);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b bg-gray-50/80 dark:bg-gray-900/40 dark:border-gray-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="text-xs font-medium text-gray-500 hidden sm:inline">{t("serverLogs")}</span>
        </div>
        {/* Development / Production switch */}
        <div className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-700 p-0.5">
          <button
            onClick={() => switchEnv("development")}
            className={`flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium transition-colors ${env === "development" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
          >
            <Code2 className="w-3 h-3" />{t("development")}
          </button>
          <button
            onClick={() => switchEnv("production")}
            className={`flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium transition-colors ${env === "production" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
          >
            <Rocket className="w-3 h-3" />{t("production")}
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 shrink-0"
          onClick={() => fetchLogs(env)}
          disabled={loading}
          title={t("loadLogs")}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          )}
        </Button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-950 p-4">
        {!fetched[env] ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center">
              {env === "production" ? <Rocket className="w-7 h-7 text-gray-500" /> : <Code2 className="w-7 h-7 text-gray-500" />}
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">{env === "production" ? t("production") : t("development")} · {t("serverLogs")}</p>
              <p className="text-xs text-gray-600 mb-4">
                {env === "production" ? t("prodLogsHint") : t("devLogsHint")}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700"
              onClick={() => fetchLogs(env)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <Terminal className="w-3.5 h-3.5 mr-2" />
              )}
              {t("loadLogs")}
            </Button>
          </div>
        ) : (
          <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap break-words leading-relaxed">
            {logs[env]}
          </pre>
        )}
      </div>
    </div>
  );
}
