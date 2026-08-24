"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { vcaasApi } from "@/lib/vcaas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Rocket, Loader2, Eye, Database, Key, Globe, Terminal,
  RefreshCw, Server, PanelLeftClose, PanelLeft, Monitor, Smartphone,
  ExternalLink, Sparkles, ChevronDown, FolderOpen, Plus, AlertTriangle,
  Clock, X, Github, Code2, ArrowLeft, Figma, MousePointerClick,
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
import { GithubPanel } from "@/components/workspace/GithubPanel";
import { CodePanel } from "@/components/workspace/CodePanel";
import type { VcaasProject, ConversationMessage } from "@/lib/vcaas-types";
import { useServerWake } from "@/components/workspace/use-server-wake";
import { ServerWakeNotice } from "@/components/workspace/ServerWakeNotice";
import { ServerBlockedDialog, useServerBlocked } from "@/components/workspace/ServerBlockedDialog";
import { FigmaModal } from "@/components/workspace/FigmaModal";
import { OperationBanner } from "@/components/workspace/OperationBanner";
import { PublishedModal } from "@/components/workspace/PublishedModal";
import { useProjectOperation } from "@/components/workspace/use-project-operation";
import { getPublishedHost, getPreviewUrlField } from "@/lib/project-status";
import { useVisualEditor } from "@/components/workspace/visual-editor/use-visual-editor";
import { VisualEditorPanel } from "@/components/workspace/visual-editor/VisualEditorPanel";
import { VisualChangesBar } from "@/components/workspace/visual-editor/VisualChangesBar";
import { t as translate } from "@/i18n";

// Pick the correct development preview URL following the VCaaS docs:
// use `developmentUrlFieldToUse` to decide between the live server URL and the
// cached static snapshot; default to `temporalDevelopmentProjectUrl` if null/undefined.
function getPreviewUrlFromProject(proj: VcaasProject): string | null {
  const field = proj.developmentUrlFieldToUse || "temporalDevelopmentProjectUrl";
  const url = (proj as unknown as Record<string, unknown>)[field] || proj.temporalDevelopmentProjectUrl;
  return (url as string) || null;
}

// True when the preview being shown is the cached snapshot (dev server not active).
function isCachedPreview(proj: VcaasProject): boolean {
  return proj.developmentUrlFieldToUse === "cachedDevelopmentUrl";
}

// Colour + label for a custom-domain status, used in the deploy popup.
function domainStatusMeta(status: string | undefined): { color: string; label: string } {
  switch (status) {
    case "active": return { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Active" };
    case "pending_validation": return { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Pending DNS" };
    case "pending_deployment": return { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Deploying" };
    case "blocked": return { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Blocked" };
    default: return { color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", label: status || "Pending" };
  }
}

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  /**
   * ═══⭐⭐ THE SLEEPING SANDBOX, AND THE ONE PLACE THAT EXPLAINS IT ═════════
   *
   * A project whose sandbox has been archived cannot be written to, rebuilt, published,
   * synced or restored: VCaaS starts the server itself and refuses the action with
   * `SERVER_NOT_READY`. `useServerWake` turns that refusal into a wait with a clock, and
   * `useServerBlocked` + `<ServerBlockedDialog>` turn it into a sentence the user can act
   * on. Both are lifted from totalum-platform unchanged — see the notes in those files.
   */
  const serverWake = useServerWake(projectId);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [figmaConnected, setFigmaConnected] = useState(false);

  /**
   * ═══⭐⭐ THE LONG OPERATIONS, AND THE BANNER THAT OWNS THEM ═══════════════
   *
   * Publish, rebuild, GitHub pull, restore-a-version and restart-the-server all take
   * minutes, all take the app down or replace it while they run, and all used to be
   * invisible the moment the toast faded. `useProjectOperation` records the one in flight
   * (persisted, so a reload does not lose it) and `<OperationBanner>` renders it with a
   * clock and an honest progress estimate. Copied from totalum-platform unchanged.
   *
   * ⚠️ ONE SLOT, DELIBERATELY. Two of these at once would be two builds racing on the
   * same sandbox, so starting one while another runs is refused rather than queued.
   */
  const operation = useProjectOperation(projectId);
  const [publishedHost, setPublishedHost] = useState<string | null>(null);

  /**
   * ═══⭐⭐⭐ THE VISUAL EDITOR ═══════════════════════════════════════════════
   *
   * Copied from totalum-platform whole — the hook, the inspector panel, the changes bar
   * and the two routes behind them (`/api/preview/*` re-serves the project same-origin so
   * the page can be scripted; `/api/visual-edit/[projectId]/apply` matches each change back
   * to the source file and writes it).
   *
   * ⚠️ IT ONLY WORKS AGAINST THE LIVE DEV SERVER. Everything it does — select an element,
   * read its computed styles, type into it — happens in a document the sandbox is
   * serving. On a sleeping project the frame is showing a STATIC ARCHIVE SNAPSHOT, and an
   * editor opened over that lets people retype headings that can never be applied: the
   * edits are computed against a copy of the app, and there is no server to write to. So
   * the toggle is refused until `liveReady` — see `visualEditBlockedReason`.
   */
  /**
   * ⚠️⚠️ ONE FRAME OWNS THIS REF, AND IT MUST BE THE VISIBLE ONE. This page renders the
   * desktop layout and the mobile layout at the same time and hides one with CSS, so BOTH
   * `<PreviewPanel>`s are mounted. Handing the ref to both makes the last one to mount win
   * — the hidden mobile frame — and then every message the editor posts goes to a document
   * nobody is looking at: the agent reports `ready` (so the panel looks connected) but
   * never receives `setActive`, and clicking the visible preview selects nothing. Only the
   * desktop instance gets `frameRef` and `proxiedSrc`; the visual editor is a desktop
   * feature here, exactly as its inspector column implies.
   */
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [visualEditorOpen, setVisualEditorOpen] = useState(false);
  const visual = useVisualEditor({
    projectId,
    iframeRef: previewFrameRef,
    enabled: visualEditorOpen,
  });
  /** An apply outlives the panel: the frame must stay proxied until it settles. */
  const visualLocked = visual.phase === "applying" || visual.phase === "rebuilding";
  const blocked = useServerBlocked();

  const TABS = [
    { id: "preview", label: "Preview", icon: Eye },
    { id: "database", label: "Database", icon: Database },
    { id: "code", label: "Code", icon: Code2 },
  ];

  // All tabs for mobile menu (includes versions/secrets/domain/github/logs)
  const ALL_TABS = [
    { id: "preview", label: "Preview", icon: Eye },
    { id: "database", label: "Database", icon: Database },
    { id: "code", label: "Code", icon: Code2 },
    { id: "versions", label: "Versions", icon: Clock },
    { id: "secrets", label: "Secrets", icon: Key },
    { id: "domain", label: "Domain", icon: Globe },
    { id: "github", label: "GitHub", icon: Github },
    { id: "logs", label: "Logs", icon: Terminal },
  ];

  const [project, setProject] = useState<VcaasProject | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [activeTab, setActiveTab] = useState("preview");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCached, setPreviewCached] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [chatWidth, setChatWidth] = useState(440);
  const [isResizing, setIsResizing] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "panel">("panel");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [iframePath, setIframePath] = useState("/");
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [deployMenuOpen, setDeployMenuOpen] = useState(false);
  const deployMenuRef = useRef<HTMLDivElement>(null);

  const mountedRef = useRef(true);
  const sendingRef = useRef(false);
  const autoSentRef = useRef(false);
  // Guards the poll loop right after a new run is started: the server may still
  // report the PREVIOUS run's "done"/"idle" for a moment, and concluding on that
  // stale status would wipe the just-sent message and stop polling. We wait to
  // actually observe "init" before allowing a "done"/"idle" to conclude the run.
  const pendingRunRef = useRef(false);
  const runWaitPollsRef = useRef(0);
  // Attachments the user sent this session, in order. The VCaaS conversation API
  // does not echo attachments back, so when fetchConversation() replaces the
  // message list we re-hydrate the chips/thumbnails onto matching user messages.
  const sentFilesRef = useRef<{ message: string; files: { name: string; url: string; imageDescription: string }[] }[]>([]);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Global dark mode
  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add("dark"); document.body.style.background = "#1a1a1a"; document.body.style.color = "#e5e5e5"; }
    else { document.documentElement.classList.remove("dark"); document.body.style.background = ""; document.body.style.color = ""; }
    return () => { document.documentElement.classList.remove("dark"); document.body.style.background = ""; document.body.style.color = ""; };
  }, [darkMode]);

  // Close menu on outside click or iframe blur
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is inside the menu trigger OR the popup itself
      if (menuRef.current && menuRef.current.contains(target)) return;
      // Also check by data attribute on the popup
      const popup = document.querySelector("[data-popup-menu]");
      if (popup && popup.contains(target)) return;
      setMenuOpen(false);
    };
    const handleBlur = () => setMenuOpen(false);
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("blur", handleBlur);
    return () => { window.removeEventListener("mousedown", handleClick); window.removeEventListener("blur", handleBlur); };
  }, [menuOpen]);

  // Close deploy menu on outside click
  useEffect(() => {
    if (!deployMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (deployMenuRef.current && deployMenuRef.current.contains(target)) return;
      const popup = document.querySelector("[data-deploy-menu]");
      if (popup && popup.contains(target)) return;
      setDeployMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => { window.removeEventListener("mousedown", handleClick); };
  }, [deployMenuOpen]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); resizeRef.current = { startX: e.clientX, startWidth: chatWidth }; setIsResizing(true);
  }, [chatWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => { if (resizeRef.current) setChatWidth(Math.max(280, Math.min(600, resizeRef.current.startWidth + (e.clientX - resizeRef.current.startX)))); };
    const handleUp = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMove); window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [isResizing]);

  async function fetchProject(): Promise<VcaasProject | null> {
    const res = await vcaasApi.projects.get(projectId);
    if (res.ok && res.data && mountedRef.current) { setProject(res.data); setPreviewUrl(getPreviewUrlFromProject(res.data)); setPreviewCached(isCachedPreview(res.data)); return res.data; } return null;
  }
  async function fetchConversation(): Promise<void> {
    const res = await vcaasApi.agent.fullConversation(projectId);
    if (res.ok && res.data && mountedRef.current) setMessages(rehydrateAttachments(res.data.conversation || []));
  }
  // The server conversation has no attachment info; walk it in order and re-attach
  // the files we recorded when sending, so attachment chips survive a refetch.
  function rehydrateAttachments(conversation: ConversationMessage[]): ConversationMessage[] {
    if (sentFilesRef.current.length === 0) return conversation;
    const pending = [...sentFilesRef.current];
    return conversation.map((m) => {
      if (m.author !== "user") return m;
      const idx = pending.findIndex((p) => p.message === m.message);
      if (idx === -1) return m;
      const [match] = pending.splice(idx, 1);
      return { ...m, inputFiles: match.files };
    });
  }
  // Lightweight GitHub connection check — drives the green "connected" bubble on the GitHub icon.
  async function fetchGithubStatus(): Promise<void> {
    const res = await vcaasApi.github.status(projectId);
    if (res.ok && res.data && mountedRef.current) setGithubConnected(!!res.data.connected);
  }
  function startAgentPolling() { stopAgentPolling(); pollAgentOnce(); }
  function stopAgentPolling() { if (pollingRef.current) { clearTimeout(pollingRef.current); pollingRef.current = null; } }
  async function pollAgentOnce() {
    if (!mountedRef.current) return;
    const res = await vcaasApi.agent.status(projectId);
    if (!mountedRef.current) return;
    if (res.ok && res.data) {
      const rt = res.data.realtimeConversation || [];
      if (rt.length > 0) {
        setMessages((prev) => {
          const agentMsgs = rt.filter((m) => m.author === "agent");
          const existingAgentKeys = new Set(prev.filter((m) => m.author === "agent").map((m) => `${m.createdAt}|${m.message?.slice(0, 60)}`));
          const newAgentMsgs = agentMsgs.filter((m) => !existingAgentKeys.has(`${m.createdAt}|${m.message?.slice(0, 60)}`));
          return newAgentMsgs.length > 0 ? [...prev, ...newAgentMsgs] : prev;
        });
      }
      // Once we actually observe the run running, clear the "just started" guard.
      if (res.data.status === "init") { pendingRunRef.current = false; runWaitPollsRef.current = 0; }
      const terminal = res.data.status === "done" || res.data.status === "idle";
      // A run we just started may still show the previous run's terminal status.
      // Keep polling (fast) until we see "init", so we don't prematurely conclude
      // and wipe the freshly-sent user message via fetchConversation.
      if (terminal && pendingRunRef.current) {
        runWaitPollsRef.current += 1;
        if (runWaitPollsRef.current < 4) { pollingRef.current = setTimeout(pollAgentOnce, 3000); return; }
        pendingRunRef.current = false; // extremely fast/edge run — stop waiting and conclude
      }
      if (terminal) {
        const proj = await fetchProject(); await fetchConversation();
        if (proj && mountedRef.current) setPreviewKey((k) => k + 1); return;
      }
    }
    pollingRef.current = setTimeout(pollAgentOnce, 10000);
  }
  async function pollDeployOnce() {
    if (!mountedRef.current) return;
    const res = await vcaasApi.deployments.status(projectId);
    if (!mountedRef.current) return;
    if (res.ok && res.data) {
      if (res.data.status === "success") {
        setDeploying(false);
        operation.end("publish");
        toast.success("Published successfully!");
        const proj = await fetchProject();
        /**
         * ⭐ THE ONE OPERATION THAT EARNS A DIALOG. The whole point of publishing is the
         * ADDRESS — to click, to copy, to send to somebody — and a toast that disappears
         * in four seconds is the wrong place for it.
         */
        setPublishedHost(getPublishedHost(proj, projectId));
        // Surface the deploy result in the chat and pull the latest conversation.
        const liveUrl = proj?.productionProjectUrl || project?.productionProjectUrl || `${projectId}.totalum-project.com`;
        setMessages((prev) => [...prev, {
          author: "agent",
          message: `${"🚀 Your app is now live at"} https://${liveUrl}`,
          messageType: "finished",
          createdAt: new Date().toISOString(),
        }]);
        fetchConversation();
        return;
      }
      if (res.data.status === "error") { setDeploying(false); operation.end("publish"); toast.error("Deployment failed"); return; }
    }
    setTimeout(pollDeployOnce, 10000);
  }
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      const [proj] = await Promise.all([fetchProject(), fetchConversation(), fetchGithubStatus()]);
      if (cancelled) return; setLoading(false);
      if (proj?.agentProcessStatus === "init") startAgentPolling();
      if (proj?.deployment?.status === "deploying") { setDeploying(true); pollDeployOnce(); }
    }
    init(); return () => { cancelled = true; stopAgentPolling(); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Core send routine — accepts an explicit prompt text so it can be driven both
  // by the chat input and by the auto-submit flow (a project just created from the
  // dashboard whose first prompt is carried over via sessionStorage).
  const sendPromptText = useCallback(async (text: string, files?: { name: string; url: string; imageDescription: string }[]) => {
    if ((!text.trim() && (!files || files.length === 0)) || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const hasFiles = !!files && files.length > 0;
    if (hasFiles) sentFilesRef.current.push({ message: text, files: files! });
    setMessages((prev) => [...prev, { author: "user", message: text, messageType: "regular", createdAt: new Date().toISOString(), inputFiles: hasFiles ? files : undefined }]);
    setPrompt("");
    const res = await vcaasApi.agent.start(projectId, { prompt: text, inputFiles: files || [] });
    if (res.ok) {
      setProject((prev) => prev ? { ...prev, agentProcessStatus: "init" } : prev);
      pendingRunRef.current = true; runWaitPollsRef.current = 0;
      startAgentPolling();
    }
    else { toast.error(res.error || "Failed to start agent"); }
    setSending(false);
    sendingRef.current = false;
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendPrompt = async (files?: { name: string; url: string; imageDescription: string }[]) => {
    if (project?.agentProcessStatus === "init") return;
    await sendPromptText(prompt, files);
  };

  // Auto-submit the first prompt when arriving from the dashboard "Build" flow.
  // The dashboard stashes the prompt (and any files) in sessionStorage keyed by
  // projectId; once the project is loaded and idle, we send it automatically so
  // the agent starts building right away.
  useEffect(() => {
    if (loading || !project || autoSentRef.current) return;
    if (project.agentProcessStatus === "init") return;
    const promptKey = `vibebuild:pendingPrompt:${projectId}`;
    const pending = typeof window !== "undefined" ? sessionStorage.getItem(promptKey) : null;
    if (!pending) return;
    autoSentRef.current = true;
    sessionStorage.removeItem(promptKey);
    const filesKey = `vibebuild:pendingFiles:${projectId}`;
    let files: { name: string; url: string; imageDescription: string }[] | undefined;
    try {
      const raw = sessionStorage.getItem(filesKey);
      if (raw) files = JSON.parse(raw);
    } catch { /* ignore */ }
    sessionStorage.removeItem(filesKey);
    sendPromptText(pending, files);
  }, [loading, project, projectId, sendPromptText]);
  /**
   * ═══⭐⭐⭐ THE ONE PLACE A LONG OPERATION FINISHES ═════════════════════════
   *
   * ⚠️ EVERY ONE OF THESE ENDS SOMEWHERE ELSE THAN IT STARTED — a restart finishes when
   * the sandbox says `Active`, a pull when GitHub's sync reports done, a restore when the
   * project stops reporting a recovery. Watching them in the component that fired the
   * request would mean the watch dies whenever that panel unmounts, which is precisely
   * what people do while they wait. One watcher on the page, keyed on the slot, survives
   * tab switches and (because the record is persisted) page reloads.
   *
   * ⚠️ IT IS BOUNDED. A job that stops reporting must not leave the banner up for the rest
   * of the session, so the watch gives up after `MAX_WATCH_ATTEMPTS` and says it stopped
   * watching rather than claiming a failure it did not observe.
   *
   * ⚠️ `publish` AND `rebuild` ARE NOT HERE. Both already have a poll that owns them (the
   * deploy poll below, and the Code panel's rebuild poll), and two watchers on one job is
   * how a banner gets cleared while the work is still running.
   */
  useEffect(() => {
    const kind = operation.kind;
    if (!kind || kind === "publish" || kind === "rebuild") return;

    const MAX_WATCH_ATTEMPTS = 60; // 60 × 8s = 8 minutes
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (message?: string) => {
      operation.end(kind);
      if (message) toast.success(message);
      fetchProject();
      setPreviewKey((k) => k + 1);
    };

    const tick = async () => {
      if (cancelled) return;
      attempts += 1;

      if (kind === "restartServer") {
        const detail = await vcaasApi.projects.get(projectId);
        if (cancelled) return;
        if (detail.ok && detail.data?.agentServerStatus === "Active") return finish("Your server is back");
      }

      if (kind === "githubPull") {
        const status = await vcaasApi.github.pullStatus(projectId);
        if (cancelled) return;
        if (status.ok && status.data && status.data.status !== "pulling") {
          return finish(status.data.status === "error" ? undefined : "Pulled from GitHub");
        }
      }

      if (kind === "restoreVersion") {
        const detail = await vcaasApi.projects.get(projectId);
        if (cancelled) return;
        // `versionRecovery` is present only while one is running; `error` is terminal too.
        const recovery = detail.data?.versionRecovery;
        if (detail.ok && (!recovery || recovery.status === "error")) {
          return finish(recovery?.status === "error" ? undefined : "Version restored");
        }
      }

      if (attempts >= MAX_WATCH_ATTEMPTS) {
        operation.end(kind);
        toast.warning("We stopped watching this — it may still be finishing. Refresh in a moment.");
        return;
      }
      timer = setTimeout(tick, 8000);
    };

    timer = setTimeout(tick, 8000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [operation.kind, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * ⭐ IS THE LIVE APP ACTUALLY THERE? Both halves are required: the machine has to be up,
   * and the project has to be RECOMMENDING the live url — which upstream only does once
   * it has fetched that url and seen a real page. `Active` on its own is a server with
   * nothing served on it yet, and that window is minutes wide.
   */
  const liveReady =
    project?.agentServerStatus === "Active" &&
    getPreviewUrlField(project) === "temporalDevelopmentProjectUrl" &&
    !!project?.temporalDevelopmentProjectUrl;

  /**
   * ⚠️ NOTHING MAY BE EDITED VISUALLY WHILE THE PROJECT IS CHANGING UNDER IT. A prompt, a
   * publish, a rebuild, a pull and a restore all rewrite the files or the running server,
   * and the editor is a live document editor pointed at that server: opening it during one
   * means selecting elements in a page that is about to be replaced, then applying edits
   * computed against source that no longer exists.
   *
   * ⚠️ IT BLOCKS ENTERING, NEVER LEAVING — trapping someone inside the panel is worse than
   * the conflict this prevents.
   */
  const visualEditBlockedReason: "busy" | "starting" | null =
    project?.agentProcessStatus === "init" || operation.kind !== null
    ? "busy"
    : !liveReady
      ? "starting"
      : null;

  /**
   * ⭐⭐ APPLY — and the reason it is here rather than in the bar: closing the inspector
   * is part of applying (the page is about to be rebuilt underneath it), while the FRAME
   * must stay proxied until the phase settles, or the user's preview-only edits vanish
   * from the screen for the whole rebuild.
   */
  const handleVisualApply = useCallback(() => {
    setVisualEditorOpen(false);
    void visual.apply();
  }, [visual]);

  const handleStopAgent = async () => { await vcaasApi.agent.stop(projectId); toast.info("Stop signal sent"); };
  // Autofill the chat prompt with an edit instruction for the given file, then focus the chat.
  const handleAskAiEdit = useCallback((path: string) => {
    setPrompt(`On file ${path} write what you want to edit`);
    setChatCollapsed(false);
    setMobileTab("chat");
    // Focus the chat textarea so the user can immediately continue typing.
    setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>("[data-chat-input]");
      if (el) { el.focus(); const len = el.value.length; el.setSelectionRange(len, len); }
    }, 60);
  }, []);
  const handleDeploy = async () => {
    if (deploying) return; setDeploying(true);
    const res = await vcaasApi.deployments.deploy(projectId);

    /**
     * ⭐ THE SERVER WAS ASLEEP, SO VCaaS STARTED IT AND REFUSED THE PUBLISH. Not a
     * failure: the strip shows the wait and the dialog explains it. `claim` also tells
     * the user when it is ready — it deliberately does NOT publish for them, because an
     * action that fires minutes later, unattended, is one nobody consented to at the
     * moment it happened.
     */
    if (serverWake.claim(res, () => toast.success(translate("workspace.serverWake.readyFor", { action: translate("workspace.serverWake.actionPublish") })))) {
      setDeploying(false);
      return;
    }

    /**
     * ⭐ THE APP ITSELF IS NOT SERVING A PAGE, so upstream refuses to ship it — publishing
     * would put that broken page online. The two halves of `SANDBOX_NOT_REACHABLE` need
     * opposite advice, and totalum-backend says which one it saw.
     */
    if (res.upstreamCode === "SANDBOX_NOT_REACHABLE") {
      blocked.show(res.details?.reason === "app_error" ? "appError" : "starting");
      setDeploying(false);
      return;
    }

    if (res.ok) {
      toast.success("Deploying… this takes ~3 minutes");
      operation.begin("publish");
      pollDeployOnce();
    }
    else { toast.error(res.error || "Failed to deploy"); setDeploying(false); }
  };
  const handleRestartServer = async () => {
    const res = await vcaasApi.agent.restartServer(projectId);
    if (res.ok) {
      toast.success("Server restarting...");
      /**
       * ⚠️ THE WORK HAS NOT FINISHED — it has barely started. `begin` only RECORDS the
       * operation; the banner's clock and its estimate come from the profile, and the
       * record is persisted so a reload mid-restart still shows it.
       */
      operation.begin("restartServer");
    }
    else toast.error(res.error || "Failed");
  };

  const isBuilding = project?.agentProcessStatus === "init";
  // Publish/live state for the deploy popup.
  const isPublished = project?.deployment?.status === "success";
  const publishedUrl = project?.productionProjectUrl || `${projectId}.totalum-project.com`;
  const hasDomain = !!project?.customDomain?.hostname;
  const domainActive = project?.customDomain?.status === "active";
  const leftHeaderWidth = chatCollapsed ? "auto" : chatWidth + 5;
  const pageBg = darkMode ? "#1a1a1a" : "#fcfbf8";
  const cardBg = darkMode ? "#222" : "#fff";
  const btnBorder = darkMode ? "border-gray-700/60" : "border-gray-200/60";

  if (loading) return <div className="h-screen flex flex-col items-center justify-center gap-3 dark:text-gray-200" style={{ background: pageBg }}><Loader2 className="w-7 h-7 animate-spin" /><p className="text-sm text-gray-400">{"Loading..."}</p></div>;
  if (!project) return <div className="h-screen flex flex-col items-center justify-center gap-4 dark:text-gray-200" style={{ background: pageBg }}><p className="text-gray-500">Project not found</p><Link href="/"><Button variant="outline">{"Back"}</Button></Link></div>;

  // Popup menu content (shared between desktop and mobile)
  const popupMenu = menuOpen && (
    <div data-popup-menu className="absolute top-full left-0 mt-1.5 w-56 rounded-xl shadow-xl z-[60] overflow-hidden" style={{ background: darkMode ? "#2a2a2a" : "#fff", border: `1px solid ${darkMode ? "#444" : "#e5e5e5"}` }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: darkMode ? "#444" : "#eee" }}>
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{projectId}</p>
      </div>
      <div className="py-1">
        <button onClick={() => { setMenuOpen(false); router.push("/"); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200">
          <FolderOpen className="w-4 h-4 text-gray-400" /> {"My projects"}
        </button>
        <button onClick={() => { setMenuOpen(false); router.push("/"); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200">
          <Plus className="w-4 h-4 text-gray-400" /> {"New project"}
        </button>
      </div>
      {/* Secrets + GitHub options */}
      <div className="border-t py-1" style={{ borderColor: darkMode ? "#444" : "#eee" }}>
        <button onClick={() => { setActiveTab("secrets"); setMobileTab("panel"); setMenuOpen(false); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${activeTab === "secrets" ? "text-gray-900 dark:text-white font-medium" : "text-gray-700 dark:text-gray-200"}`}>
          <Key className="w-4 h-4 text-gray-400" /> {"Secrets"}
        </button>
        <button onClick={() => { setActiveTab("github"); setMobileTab("panel"); setMenuOpen(false); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${activeTab === "github" ? "text-gray-900 dark:text-white font-medium" : "text-gray-700 dark:text-gray-200"}`}>
          <span className="relative flex items-center">
            <Github className="w-4 h-4 text-gray-400" />
            {githubConnected && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1e1e1e]" />}
          </span>
          <span className="flex-1 text-left">{"GitHub"}</span>
          {githubConnected && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{"Connected"}</span>}
        </button>
      </div>
      {/* Tabs - visible on mobile only */}
      <div className="sm:hidden border-t py-1" style={{ borderColor: darkMode ? "#444" : "#eee" }}>
        {ALL_TABS.map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileTab("panel"); setMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${activeTab === tab.id ? "text-gray-900 dark:text-white font-medium" : "text-gray-700 dark:text-gray-200"}`}>
            <tab.icon className="w-4 h-4 text-gray-400" /> {tab.label}
          </button>
        ))}
      </div>
      <div className="border-t py-1" style={{ borderColor: darkMode ? "#444" : "#eee" }}>
        {/* Publish on mobile */}
        <button onClick={() => { handleDeploy(); setMenuOpen(false); }} disabled={deploying || isBuilding}
          className="w-full sm:hidden flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200">
          <Rocket className="w-4 h-4 text-gray-400" /> {deploying ? "Deploying" : "Publish"}
        </button>
      </div>
      <div className="border-t py-1" style={{ borderColor: darkMode ? "#444" : "#eee" }}>
        <button onClick={() => { handleRestartServer(); setMenuOpen(false); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200">
          <Server className="w-4 h-4 text-gray-400" /> {"Restart Agent Server"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden dark:text-gray-200" style={{ background: pageBg }}>
      {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize" />}

      {/* ═══ DESKTOP LAYOUT ═══ */}
      <div className="hidden sm:flex flex-col h-full">
        {/* Desktop header 48px */}
        <header className="flex items-stretch shrink-0 z-10" style={{ height: 48 }}>
          {/* LEFT: aside width */}
          <div className="flex items-center gap-1.5 px-3 shrink-0" style={{ width: typeof leftHeaderWidth === "number" ? leftHeaderWidth : undefined }}>
            <Link href="/" title={"Back"} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="relative flex-1 min-w-0" ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1.5 max-w-full rounded-lg px-1.5 py-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <div className="w-5 h-5 rounded bg-gray-900 dark:bg-white flex items-center justify-center shrink-0"><Sparkles className="w-2.5 h-2.5 text-white dark:text-gray-900" /></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{projectId}</span>
                <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
              </button>
              {popupMenu}
            </div>
            <button onClick={() => setActiveTab("versions")} className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors shrink-0 border ${btnBorder} ${activeTab === "versions" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"}`} title={"Versions"}>
              <Clock className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setChatCollapsed(!chatCollapsed)} className={`h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 border ${btnBorder} transition-colors shrink-0`}>
              {chatCollapsed ? <PanelLeft className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
            </button>
          </div>
          {/* RIGHT: preview width */}
          <div className="flex items-center flex-1 min-w-0 gap-1.5 px-3">
            <div className="flex items-center gap-1 shrink-0">
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 h-7 px-2.5 rounded-lg text-sm font-medium transition-all border ${btnBorder} ${activeTab === tab.id ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 bg-transparent"}`}>
                  <tab.icon className="w-3.5 h-3.5" /><span className="hidden lg:inline">{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="flex-1 flex items-center justify-center min-w-0">
              <div className={`flex items-center h-7 w-[320px] rounded-full border ${btnBorder} px-1.5 gap-1`}>
                <button onClick={() => setActiveTab("logs")} className={`p-1 rounded shrink-0 ${activeTab === "logs" ? "text-gray-900 dark:text-white" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`} title={"Logs"}><Terminal className="w-3.5 h-3.5" /></button>
                <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-600 shrink-0" />
                <button onClick={() => setMobilePreview(!mobilePreview)} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">{mobilePreview ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}</button>
                <input value={iframePath} onChange={(e) => setIframePath(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setPreviewKey((k) => k + 1); }} className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm font-mono text-gray-600 dark:text-gray-300 placeholder:text-gray-400 px-1" placeholder="/" />
                <button className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0" onClick={() => { fetchProject(); setPreviewKey((k) => k + 1); }}><RefreshCw className="w-3.5 h-3.5" /></button>
                {previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>}
              </div>
            </div>
            {/* Secrets + GitHub quick-access icons, right next to Publish */}
            <button onClick={() => setActiveTab("secrets")} className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors shrink-0 border ${btnBorder} ${activeTab === "secrets" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"}`} title={"Secrets"}>
              <Key className="w-3.5 h-3.5" />
            </button>
            {/*
              ⭐⭐ EDIT VISUALLY. Refused — with the reason — rather than opened over a
              document it cannot edit; see `visualEditBlockedReason`.
            */}
            <button
              onClick={() => {
                if (visualEditorOpen) { setVisualEditorOpen(false); return; }
                if (visualEditBlockedReason === "busy") {
                  toast.info("Your project is changing right now — try again when it settles.");
                  return;
                }
                if (visualEditBlockedReason === "starting") {
                  blocked.show("starting");
                  return;
                }
                setActiveTab("preview");
                setVisualEditorOpen(true);
              }}
              className={`relative h-7 w-7 flex items-center justify-center rounded-lg transition-colors shrink-0 border ${btnBorder} ${visualEditorOpen ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"}`}
              title={visualEditorOpen ? "Close the visual editor" : "Edit visually"}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
            </button>
            {/*
              ⭐ FIGMA — A MODAL, NOT A TAB, and deliberately so: connecting is a
              once-per-project errand with a token in it, not a place you work. The panel
              itself is the platform's, copied unchanged.
            */}
            <button onClick={() => setFigmaOpen(true)} className={`relative h-7 w-7 flex items-center justify-center rounded-lg transition-colors shrink-0 border ${btnBorder} text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10`} title={figmaConnected ? "Figma connected" : "Figma"}>
              <Figma className="w-3.5 h-3.5" />
              {figmaConnected && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1e1e1e]" />}
            </button>
            <button onClick={() => setActiveTab("github")} className={`relative h-7 w-7 flex items-center justify-center rounded-lg transition-colors shrink-0 border ${btnBorder} ${activeTab === "github" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"}`} title={githubConnected ? ("GitHub connected") : "GitHub"}>
              <Github className="w-3.5 h-3.5" />
              {githubConnected && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1e1e1e]" />}
            </button>
            <div className="relative shrink-0" ref={deployMenuRef}>
              <Button size="sm" onClick={() => setDeployMenuOpen(!deployMenuOpen)} disabled={deploying || isBuilding} className={`bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 h-7 text-sm rounded-lg px-3 border ${btnBorder}`}>
                {deploying ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{"Deploying"}</> : <><Rocket className="w-3.5 h-3.5 mr-1" />{"Publish"}</>}
              </Button>
              {/* Small "takes ~3 min" caption while deploying */}
              {deploying && (
                <span className="absolute top-full right-0 mt-1 flex items-center gap-1 text-[10px] text-gray-400 whitespace-nowrap">
                  <Clock className="w-2.5 h-2.5" />{"Deploying… this takes ~3 minutes"}
                </span>
              )}
              {deployMenuOpen && (
                <div data-deploy-menu className="absolute top-full right-0 mt-1.5 w-72 rounded-xl shadow-xl z-[60] overflow-hidden" style={{ background: darkMode ? "#2a2a2a" : "#fff", border: `1px solid ${darkMode ? "#444" : "#e5e5e5"}` }}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: darkMode ? "#444" : "#eee" }}>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{"Publish"}</p>
                    <button onClick={() => setDeployMenuOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="p-3 space-y-2">
                    {/* Current live URL — only when the project has been published */}
                    {isPublished ? (
                      <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{"Live now"}{domainActive ? " · " + ("domain") : ""}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-emerald-800 dark:text-emerald-300 flex-1 truncate">{publishedUrl}</code>
                          <a href={`https://${publishedUrl}`} target="_blank" rel="noopener noreferrer" title={"Open live site"} className="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-300 shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2 text-[11px] text-gray-400">
                        {"Not published yet"}
                      </div>
                    )}

                    <button onClick={() => { handleDeploy(); setDeployMenuOpen(false); }} disabled={deploying || isBuilding}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 disabled:opacity-50">
                      <Rocket className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="text-left min-w-0">
                        <p className="font-medium">{"Deploy now"}</p>
                        <p className="text-xs text-gray-400 truncate">{publishedUrl}</p>
                      </div>
                    </button>
                    {/* ~3 minute hint */}
                    <p className="flex items-start gap-1.5 text-[10px] text-gray-400 px-1 leading-snug">
                      <Clock className="w-3 h-3 mt-px shrink-0" />{"Building & deploying takes ~3 minutes. You can keep working meanwhile."}
                    </p>

                    <button onClick={() => { setActiveTab("domain"); setDeployMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700">
                      <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-medium">{"Custom Domain"}</p>
                        <p className="text-xs text-gray-400 truncate">{project?.customDomain?.hostname || ("Configure your domain")}</p>
                      </div>
                      {hasDomain && (
                        <span className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${domainStatusMeta(project?.customDomain?.status).color}`}>
                          {domainStatusMeta(project?.customDomain?.status).label}
                        </span>
                      )}
                    </button>
                    {/* When a domain is added but not yet live, remind about propagation */}
                    {hasDomain && !domainActive && (
                      <p className="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 px-1 leading-snug">
                        <AlertTriangle className="w-3 h-3 mt-px shrink-0" />{"DNS changes can take up to 5 hours to propagate. Your domain will go live automatically once the records are verified."}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        {/* Desktop main */}
        <div className="flex-1 flex overflow-hidden">
          <div className={`flex flex-col shrink-0 transition-all ${chatCollapsed ? "w-0 overflow-hidden" : ""}`} style={chatCollapsed ? {} : { width: chatWidth, background: cardBg }}>
            <ChatPanel messages={messages} isBuilding={isBuilding} prompt={prompt} setPrompt={setPrompt} onSend={handleSendPrompt} onStop={handleStopAgent} sending={sending} projectId={projectId} projectSecrets={project?.secrets} />
          </div>
          {!chatCollapsed && (
            <div className="flex w-1 hover:w-1.5 bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 cursor-col-resize transition-all items-center justify-center shrink-0" onMouseDown={handleResizeStart}>
              <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-600 rounded-full" />
            </div>
          )}
          <div className="flex-1 flex flex-col min-w-0">
            {/*
              ⭐ THE WAKE STRIP, ABOVE THE PANEL THAT OWNS THE ACTION. Publish, rebuild, a
              file save and a version restore all land here. It is a strip in the panel
              column, never an overlay, so the rest of the workspace stays usable while the
              server comes up — the dialog is the interruption, this is the progress.
            */}
            {/*
              ⭐ THE OPERATION BANNER, ABOVE EVERYTHING IT AFFECTS. Publish, rebuild, pull,
              restore and restart all replace or take down the app the panel below is
              showing, so the explanation belongs above that panel and not in a toast that
              is gone before the work is.
            */}
            {operation.kind && (
              <div className="px-2 pt-2 sm:px-3">
                <OperationBanner kind={operation.kind} elapsedMs={operation.elapsedMs} />
              </div>
            )}
            {(serverWake.waking || serverWake.failed) && (
              <div className="px-2 pt-2 sm:px-3">
                <ServerWakeNotice wake={serverWake} manualRetry={!serverWake.willRetry} />
              </div>
            )}
            <div className={`flex-1 overflow-hidden ${activeTab === "preview" ? "rounded-none" : "m-2 sm:m-3 rounded-xl shadow-sm"}`} style={{ background: cardBg }}>
              {activeTab === "preview" && <PreviewPanel key={previewKey} previewUrl={previewUrl} cached={previewCached} onRefresh={() => { fetchProject(); setPreviewKey((k) => k + 1); }} loading={isBuilding} mobilePreview={mobilePreview} iframePath={iframePath} frameRef={previewFrameRef} /* ⭐ Same-origin ONLY while the editor is open — and for the length of an apply, which outlives the panel: dropping the proxy mid-apply would reload the frame and throw away the preview-only edits the user is watching. */ proxiedSrc={visualEditorOpen || visualLocked ? `/api/preview/${encodeURIComponent(projectId)}` : null} />}
              {activeTab === "code" && <CodePanel projectId={projectId} darkMode={darkMode} onAskAiEdit={handleAskAiEdit} wake={serverWake} onRebuildStarted={() => operation.begin("rebuild")} onRebuildFinished={() => operation.end("rebuild")} />}
              {activeTab === "database" && <DatabasePanel projectId={projectId} />}
              {activeTab === "versions" && <VersionsPanel projectId={projectId} wake={serverWake} onVersionRestored={() => fetchProject()} onRestoreStarted={() => operation.begin("restoreVersion")} />}
              {activeTab === "secrets" && <SecretsPanel projectId={projectId} secrets={project.secrets || []} onSecretsChanged={() => fetchProject()} />}
              {activeTab === "domain" && <DomainPanel projectId={projectId} domain={project.customDomain} productionUrl={project.productionProjectUrl} onDomainChanged={() => fetchProject()} />}
              {activeTab === "github" && <GithubPanel projectId={projectId} wake={serverWake} onStatusChange={setGithubConnected} onPullStarted={() => operation.begin("githubPull")} />}
              {activeTab === "logs" && <LogsPanel projectId={projectId} />}
            </div>
            {/* F12 — the bar owns the whole batch: count, undo, discard and apply. */}
            <VisualChangesBar
              changes={visual.changes}
              phase={visual.phase}
              outcome={visual.outcome}
              error={visual.error}
              onUndo={visual.undoChange}
              onDiscardAll={visual.discardAll}
              onApply={handleVisualApply}
              onDismissOutcome={visual.reset}
            />
          </div>
          {/*
            ⚠️ A COLUMN, NOT AN OVERLAY — the inspector must never cover the element being
            edited, which is the one thing the user is looking at.
          */}
          {visualEditorOpen && (
            <div className="w-[19rem] shrink-0 xl:w-[21rem] overflow-hidden border-l border-gray-200 dark:border-gray-800">
              <VisualEditorPanel
                projectId={projectId}
                selected={visual.selected}
                ready={visual.ready}
                locked={visualLocked}
                palette={visual.palette}
                onChange={(kind, before, after, options) => {
                  if (!visual.selected) return;
                  visual.pushChange(kind, before, after, visual.selected.signature, options);
                }}
                onAskAi={seed => {
                  setPrompt(seed);
                  setChatCollapsed(false);
                  setMobileTab("chat");
                  requestAnimationFrame(() => {
                    document.querySelector<HTMLTextAreaElement>("[data-chat-input]")?.focus();
                  });
                }}
                /**
                 * ⚠️ CLOSING DISCARDS THE BATCH, and that is the honest reading of
                 * "nothing is saved until you apply": the frame swaps back to the direct
                 * preview where none of these edits exist, so leaving them in the bar
                 * would let someone apply changes they can no longer see.
                 */
                onClose={() => {
                  visual.discardAll();
                  setVisualEditorOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ═══ MOBILE LAYOUT: header → content → fixed switch → fixed textarea ═══ */}
      <div className="flex sm:hidden flex-col h-full">
        {/* Mobile header */}
        <header className="flex items-center gap-1 px-2 shrink-0 z-10" style={{ height: 44 }}>
          <Link href="/" title={"Back"} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <div className="w-5 h-5 rounded bg-gray-900 dark:bg-white flex items-center justify-center shrink-0"><Sparkles className="w-2.5 h-2.5 text-white dark:text-gray-900" /></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[160px]">{projectId}</span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>
            {popupMenu}
          </div>
        </header>

        {/* Mobile content area */}
        <div className="flex-1 overflow-hidden" style={{ background: cardBg }}>
          {mobileTab === "chat" ? (
            <div className="flex flex-col h-full">
              {/* Chat messages only - no input here */}
              <ChatPanel messages={messages} isBuilding={isBuilding} prompt={prompt} setPrompt={setPrompt} onSend={handleSendPrompt} onStop={handleStopAgent} sending={sending} projectId={projectId} projectSecrets={project?.secrets} />
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              {activeTab === "preview" && <PreviewPanel key={previewKey} previewUrl={previewUrl} cached={previewCached} onRefresh={() => { fetchProject(); setPreviewKey((k) => k + 1); }} loading={isBuilding} mobilePreview={false} iframePath={iframePath} />}
              {activeTab === "code" && <CodePanel projectId={projectId} darkMode={darkMode} onAskAiEdit={handleAskAiEdit} wake={serverWake} onRebuildStarted={() => operation.begin("rebuild")} onRebuildFinished={() => operation.end("rebuild")} />}
              {activeTab === "database" && <DatabasePanel projectId={projectId} />}
              {activeTab === "versions" && <VersionsPanel projectId={projectId} wake={serverWake} onVersionRestored={() => fetchProject()} onRestoreStarted={() => operation.begin("restoreVersion")} />}
              {activeTab === "secrets" && <SecretsPanel projectId={projectId} secrets={project.secrets || []} onSecretsChanged={() => fetchProject()} />}
              {activeTab === "domain" && <DomainPanel projectId={projectId} domain={project.customDomain} productionUrl={project.productionProjectUrl} onDomainChanged={() => fetchProject()} />}
              {activeTab === "github" && <GithubPanel projectId={projectId} wake={serverWake} onStatusChange={setGithubConnected} onPullStarted={() => operation.begin("githubPull")} />}
              {activeTab === "logs" && <LogsPanel projectId={projectId} />}
            </div>
          )}
        </div>

        {/* Fixed switch: Preview / Chat */}
        <div className="shrink-0 flex items-center justify-center py-2 px-4" style={{ background: pageBg }}>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-full p-1 w-full max-w-xs">
            <button onClick={() => setMobileTab("panel")} className={`w-1/2 py-2 rounded-full text-sm font-medium text-center transition-colors ${mobileTab === "panel" ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white" : "text-gray-500"}`}>{"Preview"}</button>
            <button onClick={() => setMobileTab("chat")} className={`w-1/2 py-2 rounded-full text-sm font-medium text-center transition-colors ${mobileTab === "chat" ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white" : "text-gray-500"}`}>{"Chat"}</button>
          </div>
        </div>
      </div>

      {/*
        ⭐ MOUNTED ONCE FOR THE WHOLE WORKSPACE. It listens for the wake's own event, so a
        refusal raised inside any panel — the code editor, the GitHub panel, the versions
        list — is answered here without a single prop being threaded through.
      */}
      <ServerBlockedDialog reason={blocked.reason} onDismiss={blocked.dismiss} wake={serverWake} />
      <PublishedModal
        open={publishedHost !== null}
        onOpenChange={open => {
          if (!open) setPublishedHost(null);
        }}
        host={publishedHost ?? ""}
        hasCustomDomain={domainActive}
        onOpenDomain={() => {
          setPublishedHost(null);
          setActiveTab("domain");
        }}
      />
      <FigmaModal
        open={figmaOpen}
        onOpenChange={setFigmaOpen}
        projectId={projectId}
        onStatusChange={setFigmaConnected}
      />
    </div>
  );
}
