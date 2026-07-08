"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Github, Loader2, Link2, Unlink, RefreshCw, ArrowDownToLine, ArrowUpFromLine,
  GitBranch, CheckCircle2, AlertTriangle, Download, Copy, ExternalLink, Info,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import type {
  GithubStatus, GithubConnectResult, GithubPullResult, GithubPullStatus,
  GithubEnv, GithubSyncDirection,
} from "@/lib/vcaas-types";

interface GithubPanelProps {
  projectId: string;
  /** Reports the current connection state to the parent (drives the header's green bubble). */
  onStatusChange?: (connected: boolean) => void;
}

export function GithubPanel({ projectId, onStatusChange }: GithubPanelProps) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Connect form
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [syncDirection, setSyncDirection] = useState<GithubSyncDirection>("totalum_to_github");
  const [connecting, setConnecting] = useState(false);

  // Actions
  const [disconnecting, setDisconnecting] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  // Env download
  const [env, setEnv] = useState<GithubEnv | null>(null);
  const [loadingEnv, setLoadingEnv] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const pullPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pullPollRef.current) clearTimeout(pullPollRef.current);
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    const res = await api.get<GithubStatus>(`/api/vcaas/projects/${projectId}/github/status`);
    if (res.ok && res.data && mountedRef.current) { setStatus(res.data); onStatusChange?.(!!res.data.connected); }
    return res.ok ? res.data : null;
  }, [projectId, onStatusChange]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchStatus();
      if (mountedRef.current) setLoading(false);
    })();
  }, [fetchStatus]);

  // Poll pull-status until the async rebuild finishes
  const pollPullStatus = useCallback(() => {
    if (pullPollRef.current) clearTimeout(pullPollRef.current);
    const tick = async () => {
      if (!mountedRef.current) return;
      const res = await api.get<GithubPullStatus>(`/api/vcaas/projects/${projectId}/github/pull-status`);
      if (!mountedRef.current) return;
      const st = res.ok ? res.data?.status : null;
      if (st === "success") {
        setRebuilding(false);
        toast.success(lang === "es" ? "Sincronización completada" : "Sync completed");
        fetchStatus();
        return;
      }
      if (st === "error") {
        setRebuilding(false);
        toast.error(lang === "es" ? "Error al sincronizar" : "Sync failed");
        return;
      }
      pullPollRef.current = setTimeout(tick, 5000);
    };
    tick();
  }, [projectId, lang, fetchStatus]);

  const handleConnect = async () => {
    if (!token.trim() || !repo.trim()) return;
    setConnecting(true);
    const res = await api.post<GithubConnectResult>(`/api/vcaas/projects/${projectId}/github/connect`, {
      token: token.trim(),
      repositoryFullName: repo.trim(),
      syncDirection,
    });
    if (res.ok && res.data) {
      toast.success(lang === "es" ? "GitHub conectado!" : "GitHub connected!");
      setToken("");
      await fetchStatus();
      if (res.data.requiresRebuild) {
        setRebuilding(true);
        toast.info(lang === "es" ? "Reconstruyendo desde GitHub..." : "Rebuilding from GitHub...");
        pollPullStatus();
      }
    } else {
      toast.error(res.error || (lang === "es" ? "No se pudo conectar. Revisa el token y los permisos." : "Failed to connect. Check the token and permissions."));
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    if (!confirm(lang === "es" ? "¿Desconectar GitHub? El código de tu proyecto no se verá afectado." : "Disconnect GitHub? Your project code is not affected.")) return;
    setDisconnecting(true);
    const res = await api.delete(`/api/vcaas/projects/${projectId}/github/connect`);
    if (res.ok) {
      toast.success(lang === "es" ? "GitHub desconectado" : "GitHub disconnected");
      setEnv(null);
      await fetchStatus();
    } else {
      toast.error(res.error || (lang === "es" ? "No se pudo desconectar" : "Failed to disconnect"));
    }
    setDisconnecting(false);
  };

  const handlePull = async () => {
    setPulling(true);
    const res = await api.post<GithubPullResult>(`/api/vcaas/projects/${projectId}/github/pull`, {});
    if (res.ok && res.data) {
      if (res.data.status === "no_changes") {
        toast.info(lang === "es" ? "No hay cambios que traer" : "No changes to pull");
      } else {
        toast.success(
          (lang === "es" ? "Trayendo cambios..." : "Pulling changes...") +
          (res.data.filesUpdated ? ` (${res.data.filesUpdated} ${lang === "es" ? "archivos" : "files"})` : "")
        );
        setRebuilding(true);
        pollPullStatus();
      }
    } else {
      toast.error(res.error || (lang === "es" ? "No se pudo traer los cambios" : "Failed to pull changes"));
    }
    setPulling(false);
  };

  const handleLoadEnv = async () => {
    setLoadingEnv(true);
    const res = await api.get<GithubEnv>(`/api/vcaas/projects/${projectId}/github/env`);
    if (res.ok && res.data && mountedRef.current) setEnv(res.data);
    else toast.error(res.error || (lang === "es" ? "No se pudieron obtener las variables" : "Failed to load env variables"));
    setLoadingEnv(false);
  };

  const copyEnv = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEnv(key);
    toast.success(lang === "es" ? "Copiado!" : "Copied!");
    setTimeout(() => setCopiedEnv(null), 2000);
  };

  const busy = connecting || disconnecting || pulling || rebuilding;

  // Connect form as a JSX element (NOT a nested component) so it is reconciled by
  // position and inputs keep focus across the parent's re-renders on each keystroke.
  const connectForm = (
    <div className="bg-white dark:bg-[#222] rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center">
          <Github className="w-5 h-5 text-white dark:text-gray-900" />
        </div>
        <div>
          <h3 className="font-semibold text-sm dark:text-gray-100">{t("ghConnectTitle")}</h3>
          <p className="text-xs text-gray-400">{t("ghConnectSubtitle")}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">{t("ghRepo")}</label>
          <Input className="h-9 text-sm font-mono" placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} disabled={connecting} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">{t("ghToken")}</label>
          <Input className="h-9 text-sm font-mono" type="password" placeholder="github_pat_..." value={token} onChange={(e) => setToken(e.target.value)} disabled={connecting} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 block">{t("ghSyncDirection")}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSyncDirection("totalum_to_github")}
              className={`flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors ${syncDirection === "totalum_to_github" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
            >
              <ArrowUpFromLine className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium dark:text-gray-100">{t("ghDirPushTitle")}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{t("ghDirPushDesc")}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSyncDirection("github_to_totalum")}
              className={`flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors ${syncDirection === "github_to_totalum" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
            >
              <ArrowDownToLine className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium dark:text-gray-100">{t("ghDirPullTitle")}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{t("ghDirPullDesc")}</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <Button className="w-full h-9 bg-gradient-to-r from-indigo-600 to-violet-600 text-white" onClick={handleConnect} disabled={connecting || !token.trim() || !repo.trim()}>
        {connecting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{t("ghConnecting")}</> : <><Link2 className="w-3.5 h-3.5 mr-1.5" />{t("ghConnect")}</>}
      </Button>

      {/* How to create the token */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1.5 mb-2">
          <RefreshCw className="w-3 h-3 text-gray-400" />
          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{t("ghHowToTitle")}</span>
        </div>
        <ol className="text-[11px] text-gray-500 dark:text-gray-400 space-y-1 list-decimal list-inside">
          <li>
            <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
              {t("ghStep1")} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </li>
          <li>{t("ghStep2")}</li>
          <li>{t("ghStep3")}</li>
          <li>{t("ghStep4")}</li>
        </ol>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white dark:bg-[#222] dark:border-gray-700 flex items-center gap-2">
        <Github className="w-4 h-4 text-gray-900 dark:text-gray-100" />
        <span className="text-sm font-medium dark:text-gray-100">{t("github")}</span>
        {status?.connected && (
          <Badge className="ml-auto text-[9px] h-4 border-0 bg-emerald-100 text-emerald-700">{t("connected")}</Badge>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : status?.tokenExpired ? (
          /* Token expired — ask to reconnect */
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">{t("ghTokenExpiredTitle")}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {t("ghTokenExpiredDesc")}
                  {status.repositoryFullName ? ` (${status.repositoryFullName})` : ""}
                </p>
              </div>
            </div>
            {connectForm}
          </>
        ) : status?.connected ? (
          /* Connected view */
          <>
            {/* Repo card */}
            <div className="bg-white dark:bg-[#222] rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center shrink-0">
                    <Github className="w-5 h-5 text-white dark:text-gray-900" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate dark:text-gray-100">{status.repositoryFullName}</h3>
                      {status.tokenValid
                        ? <Badge className="text-[9px] h-4 border-0 bg-emerald-100 text-emerald-700">{t("ghTokenValid")}</Badge>
                        : <Badge className="text-[9px] h-4 border-0 bg-red-100 text-red-700">{t("ghTokenInvalid")}</Badge>}
                    </div>
                    <a
                      href={`https://github.com/${status.repositoryFullName}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1 mt-0.5"
                    >
                      github.com/{status.repositoryFullName} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500 h-8 text-xs shrink-0" onClick={handleDisconnect} disabled={busy}>
                  {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Unlink className="w-3 h-3 mr-1" /> {t("disconnect")}</>}
                </Button>
              </div>

              {/* Branches */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-md px-2 py-1">
                  <GitBranch className="w-3 h-3 text-gray-400" />
                  <span className="font-mono">{status.developBranch || "develop"}</span>
                  <span className="text-[10px] text-gray-400">· {t("ghAfterPrompt")}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-md px-2 py-1">
                  <GitBranch className="w-3 h-3 text-gray-400" />
                  <span className="font-mono">{status.productionBranch || "main"}</span>
                  <span className="text-[10px] text-gray-400">· {t("ghOnPublish")}</span>
                </div>
              </div>
            </div>

            {/* Bidirectional sync info */}
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{t("ghBidirectional")}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                  <ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{t("ghPushDesc")}</span>
                </div>
                <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                  <ArrowDownToLine className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <span>{t("ghPullDesc")}</span>
                </div>
              </div>
            </div>

            {/* Pull action */}
            <div className="bg-white dark:bg-[#222] rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm dark:text-gray-100">{t("ghPullTitle")}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{t("ghPullSubtitle")}</p>
              </div>
              <Button size="sm" className="h-9 px-4 shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white" onClick={handlePull} disabled={busy || !status.tokenValid}>
                {pulling || rebuilding
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{rebuilding ? t("ghRebuilding") : t("ghPulling")}</>
                  : <><ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />{t("ghPull")}</>}
              </Button>
            </div>

            {/* Env variables download */}
            <div className="bg-white dark:bg-[#222] rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm dark:text-gray-100">{t("ghEnvTitle")}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t("ghEnvSubtitle")}</p>
                </div>
                <Button variant="outline" size="sm" className="h-9 px-4 shrink-0" onClick={handleLoadEnv} disabled={loadingEnv}>
                  {loadingEnv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Download className="w-3.5 h-3.5 mr-1.5" />{env ? t("ghEnvReload") : t("ghEnvLoad")}</>}
                </Button>
              </div>
              {env && (
                <div className="mt-3 space-y-3">
                  {([
                    { key: "envDev", label: t("ghEnvDev"), value: env.envDev },
                    { key: "envProd", label: t("ghEnvProd"), value: env.envProd },
                  ] as const).map((block) => (
                    <div key={block.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{block.label}</span>
                        <button onClick={() => copyEnv(block.value, block.key)} className="text-gray-400 hover:text-gray-600 p-0.5">
                          {copiedEnv === block.key ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-[11px] font-mono text-gray-700 dark:text-gray-300 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                        {block.value || "—"}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Not connected — show connect form */
          connectForm
        )}
      </div>
    </div>
  );
}
