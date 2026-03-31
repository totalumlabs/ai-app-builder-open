"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RefreshCw, Terminal, Loader2 } from "lucide-react";

interface LogsPanelProps {
  projectId: string;
}

export function LogsPanel({ projectId }: LogsPanelProps) {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    console.log("[Logs] Fetching logs for:", projectId);
    const res = await api.get<{ logs: string }>(
      `/api/vcaas/projects/${projectId}/backend/dev/logs`
    );
    if (res.ok && res.data) {
      setLogs(res.data.logs || "No logs available");
    } else {
      setLogs("Failed to fetch logs. The server might not be active.");
    }
    setFetched(true);
    setLoading(false);
  }, [projectId]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b bg-gray-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-500">Server Logs</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          onClick={fetchLogs}
          disabled={loading}
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
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">Server logs</p>
              <p className="text-xs text-gray-600 mb-4">
                Click below to load the latest backend logs
              </p>
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
              Load Logs
            </Button>
          </div>
        ) : (
          <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap break-words leading-relaxed">
            {logs}
          </pre>
        )}
      </div>
    </div>
  );
}
