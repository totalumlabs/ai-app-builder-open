"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RefreshCw, Terminal, Loader2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface LogsPanelProps {
  projectId: string;
}

export function LogsPanel({ projectId }: LogsPanelProps) {
  const { t } = useI18n();
  const [logs, setLogs] = useState<string>("");
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // VCaaS exposes a single per-project log stream: /backend/dev/logs.
  // It is the live server (PORT 80) that serves BOTH the preview and the
  // published production site, so this one endpoint contains everything —
  // including runtime activity from your published site (form submits, errors…).
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<{ logs: string }>(
      `/api/vcaas/projects/${projectId}/backend/dev/logs`
    );
    if (res.ok && res.data) {
      const text = res.data.logs?.trim() ? res.data.logs : "";
      setLogs(text);
    } else {
      // Surface the REAL error so failures are debuggable (no silent/vague swallow).
      const message = res.error || t("logsFailed");
      setError(message);
      setLogs("");
    }
    setFetched(true);
    setLoading(false);
  }, [projectId, t]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b bg-gray-50/80 dark:bg-gray-900/40 dark:border-gray-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="text-xs font-medium text-gray-500 truncate">{t("serverLogs")}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 shrink-0"
          onClick={fetchLogs}
          disabled={loading}
          title={t("refreshLogs")}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-gray-950 p-4">
        {!fetched ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center">
              <Terminal className="w-7 h-7 text-gray-500" />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-sm text-gray-400 mb-1">{t("serverLogs")}</p>
              <p className="text-xs text-gray-600 mb-4">{t("logsUnifiedNote")}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700"
              onClick={fetchLogs}
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
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm text-red-300 font-medium">{t("logsFailed")}</p>
            <p className="text-xs text-gray-500 font-mono break-words max-w-md">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-1 bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700"
              onClick={fetchLogs}
              disabled={loading}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              {t("refreshLogs")}
            </Button>
          </div>
        ) : logs ? (
          <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap break-words leading-relaxed">
            {logs}
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <Terminal className="w-8 h-8 text-gray-700" />
            <p className="text-xs text-gray-500 max-w-xs">{t("noLogs")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
