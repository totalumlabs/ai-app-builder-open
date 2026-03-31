"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Rocket,
  Loader2,
  Eye,
  Database,
  GitBranch,
  Key,
  Globe,
  Terminal,
  RefreshCw,
  MoreVertical,
  Server,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { PreviewPanel } from "@/components/workspace/PreviewPanel";
import { DatabasePanel } from "@/components/workspace/DatabasePanel";
import { VersionsPanel } from "@/components/workspace/VersionsPanel";
import { SecretsPanel } from "@/components/workspace/SecretsPanel";
import { DomainPanel } from "@/components/workspace/DomainPanel";
import { LogsPanel } from "@/components/workspace/LogsPanel";
import type {
  VcaasProject,
  AgentStatus,
  ConversationMessage,
} from "@/lib/vcaas-types";

const TABS = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "database", label: "Database", icon: Database },
  { id: "versions", label: "Versions", icon: GitBranch },
  { id: "secrets", label: "Secrets", icon: Key },
  { id: "domain", label: "Domain", icon: Globe },
  { id: "logs", label: "Logs", icon: Terminal },
] as const;

function getPreviewUrlFromProject(proj: VcaasProject): string | null {
  const field = proj.developmentUrlFieldToUse || "temporalDevelopmentProjectUrl";
  const url =
    (proj as unknown as Record<string, unknown>)[field] ||
    proj.temporalDevelopmentProjectUrl;
  return (url as string) || null;
}

export default function WorkspacePage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<VcaasProject | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [activeTab, setActiveTab] = useState("preview");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const mountedRef = useRef(true);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─── Data fetching ───

  async function fetchProject(): Promise<VcaasProject | null> {
    const res = await api.get<VcaasProject>(
      `/api/vcaas/projects/${projectId}`
    );
    if (res.ok && res.data && mountedRef.current) {
      setProject(res.data);
      setPreviewUrl(getPreviewUrlFromProject(res.data));
      return res.data;
    }
    return null;
  }

  async function fetchConversation(): Promise<void> {
    const res = await api.get<{ conversation: ConversationMessage[] }>(
      `/api/vcaas/projects/${projectId}/agent/full-conversation`
    );
    if (res.ok && res.data && mountedRef.current) {
      setMessages(res.data.conversation || []);
    }
  }

  // ─── Agent polling ───

  function startAgentPolling() {
    stopAgentPolling();
    pollAgentOnce();
  }

  function stopAgentPolling() {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function pollAgentOnce() {
    if (!mountedRef.current) return;

    const res = await api.get<AgentStatus>(
      `/api/vcaas/projects/${projectId}/agent/status`
    );
    if (!mountedRef.current) return;

    if (res.ok && res.data) {
      const rt = res.data.realtimeConversation || [];
      if (rt.length > 0) {
        setMessages((prev) => {
          const keys = new Set(
            prev.map((m) => `${m.createdAt}|${m.message?.slice(0, 80)}`)
          );
          const fresh = rt.filter(
            (m) => !keys.has(`${m.createdAt}|${m.message?.slice(0, 80)}`)
          );
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      }

      if (res.data.status === "done" || res.data.status === "idle") {
        console.log("[Workspace] Agent finished, refreshing data...");
        // Refresh project & conversation
        const proj = await fetchProject();
        await fetchConversation();
        if (proj && mountedRef.current) {
          setPreviewKey((k) => k + 1);
        }
        return; // Stop polling
      }
    }

    // Schedule next poll
    pollingRef.current = setTimeout(pollAgentOnce, 10000);
  }

  // ─── Deploy polling ───

  async function pollDeployOnce() {
    if (!mountedRef.current) return;

    const res = await api.get<{ status: string }>(
      `/api/vcaas/projects/${projectId}/deployments/status`
    );
    if (!mountedRef.current) return;

    if (res.ok && res.data) {
      if (res.data.status === "success") {
        setDeploying(false);
        toast.success("Deployed successfully!");
        fetchProject();
        return;
      }
      if (res.data.status === "error") {
        setDeploying(false);
        toast.error("Deployment failed");
        return;
      }
    }

    setTimeout(pollDeployOnce, 10000);
  }

  // ─── Initial load ───

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      console.log("[Workspace] Loading project:", projectId);

      const [proj] = await Promise.all([fetchProject(), fetchConversation()]);

      if (cancelled) return;
      setLoading(false);

      if (proj?.agentProcessStatus === "init") {
        console.log("[Workspace] Agent is running, starting poll...");
        startAgentPolling();
      }

      if (proj?.deployment?.status === "deploying") {
        setDeploying(true);
        pollDeployOnce();
      }
    }

    init();

    return () => {
      cancelled = true;
      stopAgentPolling();
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Actions ───

  const handleSendPrompt = async () => {
    if (!prompt.trim() || sending || project?.agentProcessStatus === "init")
      return;
    setSending(true);

    const userMsg: ConversationMessage = {
      author: "user",
      message: prompt,
      messageType: "regular",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const currentPrompt = prompt;
    setPrompt("");

    console.log("[Workspace] Sending prompt:", currentPrompt.slice(0, 100));
    const res = await api.post(
      `/api/vcaas/projects/${projectId}/agent/start`,
      { prompt: currentPrompt, inputFiles: [] }
    );

    if (res.ok) {
      setProject((prev) =>
        prev ? { ...prev, agentProcessStatus: "init" } : prev
      );
      startAgentPolling();
    } else {
      toast.error(res.error || "Failed to start agent");
      console.error("[Workspace] Agent start error:", res.error);
    }

    setSending(false);
  };

  const handleStopAgent = async () => {
    console.log("[Workspace] Stopping agent...");
    await api.post(`/api/vcaas/projects/${projectId}/agent/stop`, {});
    toast.info("Stop signal sent to agent");
  };

  const handleDeploy = async () => {
    if (deploying) return;
    setDeploying(true);
    console.log("[Workspace] Starting deployment...");

    const res = await api.post(
      `/api/vcaas/projects/${projectId}/deployments/deploy`,
      {}
    );
    if (res.ok) {
      toast.success("Deployment started...");
      pollDeployOnce();
    } else {
      toast.error(res.error || "Failed to deploy");
      setDeploying(false);
    }
  };

  const handleRestartServer = async () => {
    console.log("[Workspace] Restarting server...");
    const res = await api.post(
      `/api/vcaas/projects/${projectId}/agent/server/start-or-restart`,
      {}
    );
    if (res.ok) {
      toast.success("Server restart started. This may take a few minutes.");
    } else {
      toast.error(res.error || "Failed to restart server");
    }
  };

  const handleRefreshPreview = () => {
    fetchProject();
    setPreviewKey((k) => k + 1);
  };

  // ─── Derived state ───

  const isBuilding = project?.agentProcessStatus === "init";

  const getServerStatusColor = () => {
    switch (project?.agentServerStatus) {
      case "Active":
        return "bg-emerald-500";
      case "Creating":
      case "Starting":
      case "Unarchiving":
        return "bg-amber-500 animate-pulse";
      case "Archived":
      case "Archiving":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  // ─── Loading & error states ───

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        <p className="text-sm text-gray-400">Loading workspace...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <p className="text-gray-500">Project not found</p>
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  // ─── Render ───

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* ── Header ── */}
      <header className="h-14 border-b flex items-center px-4 gap-3 shrink-0 bg-white z-10">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="font-semibold text-sm">{projectId}</h1>
          <div className="flex items-center gap-1.5 ml-1">
            <span className={`w-2 h-2 rounded-full ${getServerStatusColor()}`} />
            <span className="text-[11px] text-gray-400">
              {project.agentServerStatus || "Unknown"}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {project.totalCreditsSpent !== undefined && (
            <span className="text-xs text-gray-400 hidden md:block">
              {project.totalCreditsSpent.toFixed(1)} credits used
            </span>
          )}

          <Button
            size="sm"
            onClick={handleDeploy}
            disabled={deploying || isBuilding}
            className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
          >
            {deploying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5 mr-1.5" />
                Publish
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRestartServer}>
                <Server className="w-4 h-4 mr-2" />
                Restart Server
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRefreshPreview}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Preview
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Main workspace ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel (left) */}
        <div className="w-[360px] lg:w-[400px] border-r flex flex-col shrink-0">
          <ChatPanel
            messages={messages}
            isBuilding={isBuilding}
            prompt={prompt}
            setPrompt={setPrompt}
            onSend={handleSendPrompt}
            onStop={handleStopAgent}
            sending={sending}
          />
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar */}
          <div className="h-11 border-b flex items-center px-2 gap-1 shrink-0 bg-gray-50/80 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                    : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "preview" && (
              <PreviewPanel
                key={previewKey}
                previewUrl={previewUrl}
                productionUrl={project.productionProjectUrl}
                onRefresh={handleRefreshPreview}
              />
            )}
            {activeTab === "database" && (
              <DatabasePanel projectId={projectId} />
            )}
            {activeTab === "versions" && (
              <VersionsPanel
                projectId={projectId}
                onVersionRestored={() => fetchProject()}
              />
            )}
            {activeTab === "secrets" && (
              <SecretsPanel
                projectId={projectId}
                secrets={project.secrets || []}
                onSecretsChanged={() => fetchProject()}
              />
            )}
            {activeTab === "domain" && (
              <DomainPanel
                projectId={projectId}
                domain={project.customDomain}
                productionUrl={project.productionProjectUrl}
                onDomainChanged={() => fetchProject()}
              />
            )}
            {activeTab === "logs" && <LogsPanel projectId={projectId} />}
          </div>
        </div>
      </div>
    </div>
  );
}
