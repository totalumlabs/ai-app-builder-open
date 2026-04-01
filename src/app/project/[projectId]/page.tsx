"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Rocket, Loader2, Eye, Database, GitBranch, Key, Globe, Terminal,
  RefreshCw, MoreVertical, Server, PanelLeftClose, PanelLeft,
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
import type { VcaasProject, AgentStatus, ConversationMessage } from "@/lib/vcaas-types";

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
  const url = (proj as unknown as Record<string, unknown>)[field] || proj.temporalDevelopmentProjectUrl;
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
  const [chatWidth, setChatWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "panel">("chat");

  const mountedRef = useRef(true);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ── Resize with iframe overlay fix ──
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: chatWidth };
    setIsResizing(true);
  }, [chatWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      setChatWidth(Math.max(280, Math.min(600, resizeRef.current.startWidth + (e.clientX - resizeRef.current.startX))));
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [isResizing]);

  // ── Data fetching ──
  async function fetchProject(): Promise<VcaasProject | null> {
    const res = await api.get<VcaasProject>(`/api/vcaas/projects/${projectId}`);
    if (res.ok && res.data && mountedRef.current) { setProject(res.data); setPreviewUrl(getPreviewUrlFromProject(res.data)); return res.data; }
    return null;
  }

  async function fetchConversation(): Promise<void> {
    const res = await api.get<{ conversation: ConversationMessage[] }>(`/api/vcaas/projects/${projectId}/agent/full-conversation`);
    if (res.ok && res.data && mountedRef.current) setMessages(res.data.conversation || []);
  }

  // ── Agent polling ──
  function startAgentPolling() { stopAgentPolling(); pollAgentOnce(); }
  function stopAgentPolling() { if (pollingRef.current) { clearTimeout(pollingRef.current); pollingRef.current = null; } }

  async function pollAgentOnce() {
    if (!mountedRef.current) return;
    const res = await api.get<AgentStatus>(`/api/vcaas/projects/${projectId}/agent/status`);
    if (!mountedRef.current) return;
    if (res.ok && res.data) {
      const rt = res.data.realtimeConversation || [];
      if (rt.length > 0) {
        // Replace messages with full conversation from polling to avoid duplicates
        // Only add genuinely new agent messages, skip user messages (already added optimistically)
        setMessages((prev) => {
          const agentMsgs = rt.filter((m) => m.author === "agent");
          const existingAgentKeys = new Set(prev.filter((m) => m.author === "agent").map((m) => `${m.createdAt}|${m.message?.slice(0, 60)}`));
          const newAgentMsgs = agentMsgs.filter((m) => !existingAgentKeys.has(`${m.createdAt}|${m.message?.slice(0, 60)}`));
          return newAgentMsgs.length > 0 ? [...prev, ...newAgentMsgs] : prev;
        });
      }
      if (res.data.status === "done" || res.data.status === "idle") {
        const proj = await fetchProject(); await fetchConversation();
        if (proj && mountedRef.current) setPreviewKey((k) => k + 1);
        return;
      }
    }
    pollingRef.current = setTimeout(pollAgentOnce, 10000);
  }

  async function pollDeployOnce() {
    if (!mountedRef.current) return;
    const res = await api.get<{ status: string }>(`/api/vcaas/projects/${projectId}/deployments/status`);
    if (!mountedRef.current) return;
    if (res.ok && res.data) {
      if (res.data.status === "success") { setDeploying(false); toast.success("Deployed!"); fetchProject(); return; }
      if (res.data.status === "error") { setDeploying(false); toast.error("Deploy failed"); return; }
    }
    setTimeout(pollDeployOnce, 10000);
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      const [proj] = await Promise.all([fetchProject(), fetchConversation()]);
      if (cancelled) return;
      setLoading(false);
      if (proj?.agentProcessStatus === "init") startAgentPolling();
      if (proj?.deployment?.status === "deploying") { setDeploying(true); pollDeployOnce(); }
    }
    init();
    return () => { cancelled = true; stopAgentPolling(); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──
  const handleSendPrompt = async (files?: { name: string; url: string; imageDescription: string }[]) => {
    if ((!prompt.trim() && (!files || files.length === 0)) || sending || project?.agentProcessStatus === "init") return;
    setSending(true);
    // Add user message optimistically - use a special marker so we don't duplicate
    const userMsg: ConversationMessage = { author: "user", message: prompt, messageType: "regular", createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    const currentPrompt = prompt; setPrompt("");
    const res = await api.post(`/api/vcaas/projects/${projectId}/agent/start`, { prompt: currentPrompt, inputFiles: files || [] });
    if (res.ok) { setProject((prev) => prev ? { ...prev, agentProcessStatus: "init" } : prev); startAgentPolling(); }
    else toast.error(res.error || "Failed to start agent");
    setSending(false);
  };

  const handleStopAgent = async () => { await api.post(`/api/vcaas/projects/${projectId}/agent/stop`, {}); toast.info("Stop signal sent"); };
  const handleDeploy = async () => {
    if (deploying) return; setDeploying(true);
    const res = await api.post(`/api/vcaas/projects/${projectId}/deployments/deploy`, {});
    if (res.ok) { toast.success("Deploying..."); pollDeployOnce(); }
    else { toast.error(res.error || "Failed to deploy"); setDeploying(false); }
  };
  const handleRestartServer = async () => {
    const res = await api.post(`/api/vcaas/projects/${projectId}/agent/server/start-or-restart`, {});
    if (res.ok) toast.success("Server restarting..."); else toast.error(res.error || "Failed");
  };

  const isBuilding = project?.agentProcessStatus === "init";
  const getServerStatusColor = () => {
    switch (project?.agentServerStatus) {
      case "Active": return "bg-emerald-500";
      case "Creating": case "Starting": case "Unarchiving": return "bg-amber-500 animate-pulse";
      default: return "bg-gray-300";
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-3" style={{ background: "#fcfbf8" }}>
      <Loader2 className="w-7 h-7 animate-spin text-gray-800" /><p className="text-sm text-gray-400">Loading...</p>
    </div>
  );

  if (!project) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#fcfbf8" }}>
      <p className="text-gray-500">Project not found</p>
      <Link href="/dashboard"><Button variant="outline">Back</Button></Link>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#fcfbf8" }}>
      {/* Invisible overlay when resizing to prevent iframe from stealing mouse events */}
      {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize" />}

      {/* ── Header ── */}
      <header className="h-11 flex items-center px-2 shrink-0 bg-white border-b border-gray-100 z-10">
        <div className="flex items-center gap-1">
          <Link href="/dashboard">
            <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <button onClick={() => setChatCollapsed(!chatCollapsed)} className="hidden sm:flex p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
            {chatCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
          <div className="w-px h-5 bg-gray-100 mx-1 hidden sm:block" />
          <h1 className="text-sm font-medium text-gray-700 max-w-[200px] sm:max-w-[300px] truncate">{projectId}</h1>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 ${getServerStatusColor()}`} />
        </div>

        <div className="flex-1 flex items-center justify-center gap-0.5 overflow-x-auto px-2">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}>
              <tab.icon className="w-3 h-3" />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <div className="flex sm:hidden bg-gray-100 rounded-md p-0.5">
            <button onClick={() => setMobileTab("chat")} className={`px-2 py-0.5 rounded text-[10px] font-medium ${mobileTab === "chat" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>Chat</button>
            <button onClick={() => setMobileTab("panel")} className={`px-2 py-0.5 rounded text-[10px] font-medium ${mobileTab === "panel" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>View</button>
          </div>
          <Button size="sm" onClick={handleDeploy} disabled={deploying || isBuilding} className="bg-gray-900 hover:bg-gray-800 text-white h-7 text-xs rounded-md hidden sm:flex">
            {deploying ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Deploying</> : <><Rocket className="w-3 h-3 mr-1" />Publish</>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-50"><MoreVertical className="w-4 h-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDeploy} disabled={deploying || isBuilding} className="sm:hidden"><Rocket className="w-4 h-4 mr-2" />Publish</DropdownMenuItem>
              <DropdownMenuItem onClick={handleRestartServer}><Server className="w-4 h-4 mr-2" />Restart Server</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { fetchProject(); setPreviewKey((k) => k + 1); }}><RefreshCw className="w-4 h-4 mr-2" />Refresh</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat - desktop */}
        <div className={`hidden sm:flex flex-col shrink-0 bg-white transition-all ${chatCollapsed ? "w-0 overflow-hidden" : ""}`} style={chatCollapsed ? {} : { width: chatWidth }}>
          <ChatPanel messages={messages} isBuilding={isBuilding} prompt={prompt} setPrompt={setPrompt} onSend={handleSendPrompt} onStop={handleStopAgent} sending={sending} projectId={projectId} />
        </div>
        {/* Resize handle */}
        {!chatCollapsed && (
          <div className="hidden sm:flex w-1 hover:w-1.5 bg-transparent hover:bg-gray-200 cursor-col-resize transition-all items-center justify-center shrink-0" onMouseDown={handleResizeStart}>
            <div className="w-0.5 h-8 bg-gray-200 rounded-full" />
          </div>
        )}
        {/* Chat - mobile */}
        <div className={`sm:hidden flex flex-col flex-1 bg-white ${mobileTab !== "chat" ? "hidden" : ""}`}>
          <ChatPanel messages={messages} isBuilding={isBuilding} prompt={prompt} setPrompt={setPrompt} onSend={handleSendPrompt} onStop={handleStopAgent} sending={sending} projectId={projectId} />
        </div>
        {/* Right panel */}
        <div className={`flex-1 flex flex-col min-w-0 ${mobileTab !== "panel" ? "hidden sm:flex" : ""}`}>
          <div className="flex-1 overflow-hidden m-2 sm:m-3 rounded-xl bg-white shadow-sm">
            {activeTab === "preview" && <PreviewPanel key={previewKey} previewUrl={previewUrl} onRefresh={() => { fetchProject(); setPreviewKey((k) => k + 1); }} loading={isBuilding} />}
            {activeTab === "database" && <DatabasePanel projectId={projectId} />}
            {activeTab === "versions" && <VersionsPanel projectId={projectId} onVersionRestored={() => fetchProject()} />}
            {activeTab === "secrets" && <SecretsPanel projectId={projectId} secrets={project.secrets || []} onSecretsChanged={() => fetchProject()} />}
            {activeTab === "domain" && <DomainPanel projectId={projectId} domain={project.customDomain} productionUrl={project.productionProjectUrl} onDomainChanged={() => fetchProject()} />}
            {activeTab === "logs" && <LogsPanel projectId={projectId} />}
          </div>
        </div>
      </div>
    </div>
  );
}
