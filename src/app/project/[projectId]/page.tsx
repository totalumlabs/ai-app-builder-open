"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { vcaasApi } from "@/lib/vcaas";
import { Button } from "@/components/ui/button";
import {
  Rocket, Loader2, Eye, Database, Key, Globe, Terminal,
  RefreshCw, Server, PanelLeftClose, PanelLeft, Monitor, Smartphone,
  ExternalLink, Sparkles, ChevronDown, FolderOpen, Plus,
  Clock, Github, Code2, ArrowLeft, Figma, Copy,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { PreviewPanel } from "@/components/workspace/PreviewPanel";
import { DatabasePanel } from "@/components/workspace/DatabasePanel";
import { CodePanel } from "@/components/workspace/CodePanel";
import { LogsPanel } from "@/components/workspace/LogsPanel";
import { VersionsModal } from "@/components/workspace/VersionsModal";
import { SecretsModal } from "@/components/workspace/SecretsModal";
import { DomainModal } from "@/components/workspace/DomainModal";
import { GithubModal } from "@/components/workspace/GithubModal";
import { DeployControl } from "@/components/workspace/DeployControl";
import { CloneProjectDialog } from "@/components/workspace/ProjectTransferDialogs";
import { DiffViewer, type DiffSource } from "@/components/workspace/DiffViewer";
import { Modal } from "@/components/primitives";
import { ImportOverlay } from "@/components/workspace/ImportOverlay";
import { PathPicker } from "@/components/workspace/PathPicker";
import { looksLikePlaceholder } from "@/lib/preview-health";
import type { VcaasProject, ConversationMessage, ProjectVersion, AgentRunOptions, AgentInputFile } from "@/lib/vcaas-types";
import { loadAttachments, saveAttachments } from "@/lib/composer-attachments";
import { useServerWake } from "@/components/workspace/use-server-wake";
import { ServerWakeNotice } from "@/components/workspace/ServerWakeNotice";
import { ServerBlockedDialog, useServerBlocked } from "@/components/workspace/ServerBlockedDialog";
import { FigmaModal } from "@/components/workspace/FigmaModal";
import { OperationBanner } from "@/components/workspace/OperationBanner";
import { PublishedModal } from "@/components/workspace/PublishedModal";
import { useProjectOperation } from "@/components/workspace/use-project-operation";
import { OPERATION_COPY, OPERATION_PROFILES, shouldAdoptServerRebuild } from "@/lib/project-operation";
import { getPublishedHost, getPreviewUrlField } from "@/lib/project-status";
import { useVisualEditor } from "@/components/workspace/visual-editor/use-visual-editor";
import { VisualEditorPanel } from "@/components/workspace/visual-editor/VisualEditorPanel";
import { VisualChangesBar } from "@/components/workspace/visual-editor/VisualChangesBar";
import { t as translate } from "@/i18n";

// Pick the correct development preview URL following the Totalum API docs:
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

/**
 * ⭐ A PROJECT READ OLDER THAN THIS IS RE-CHECKED WHEN THE USER COMES BACK — see the
 * "stale tab" effect. The hourly archive job puts an idle sandbox to sleep while the tab
 * stays open, so the preview kept a dead live url (Cloudflare's "not available" page).
 */
const STALE_PROJECT_MS = 5 * 60_000;

/**
 * No live server behind this project: `Archived`, or no status at all while upstream
 * recommends the archive snapshot. ⚠️ Production sends NO `agentServerStatus` for a
 * sleeping project (checked 2026-09-14), so `=== "Archived"` alone never matched.
 */
function hasNoLiveServer(proj: VcaasProject | null): boolean {
  if (!proj) return false;
  return proj.agentServerStatus === "Archived" || (!proj.agentServerStatus && isCachedPreview(proj));
}

/**
 * ═══⭐⭐ THE MODALS — YOU CONSULT THEM AND COME BACK ═══════════════════════════
 *
 * Versions, secrets, the custom domain, GitHub and Figma used to be TABS in the panel
 * column, which put "restore a version" on the same footing as "look at the preview".
 * They are not places you work; they are errands. totalum-platform renders each as a
 * dialog over the workspace and so does this page now — one string names the open one,
 * so two can never be open at once. Logs has its own flag because it is sized
 * differently (a fixed-height terminal) and opens from the address bar, not a menu.
 */
type WorkspaceModal = "versions" | "secrets" | "domain" | "github" | "figma";

/** The rebuild watch after a visual apply — the platform's numbers, verbatim. */
const REBUILD_POLL_INTERVAL_MS = 6_000;
const REBUILD_POLL_TIMEOUT_MS = 10 * 60_000;
/** `idle` is only believed after the job has had this many polls to appear. */
const IDLE_POLLS_BEFORE_GIVING_UP = 3;
/** "success" is not "the app is serving" — probe the preview before reloading it. */
const PREVIEW_PROBE_ATTEMPTS = 10;
const PREVIEW_PROBE_INTERVAL_MS = 3_000;
/**
 * After an import's lock clears, how long to keep waiting for the app to actually serve
 * before calling it done anyway — the platform's number. The import DID finish; this is
 * only about not dropping the overlay onto the sandbox's "preview building" placeholder.
 */
const IMPORT_PREVIEW_GRACE_MS = 90_000;

/**
 * One shared empty list, so "this project has no attachments" is always the SAME
 * array. A fresh `[]` per render would change identity every time and re-run every
 * effect and memo downstream of it.
 */
const EMPTY_ATTACHMENTS: AgentInputFile[] = [];

/**
 * The entities the upstream sanitiser produces. `&amp;` is the one that matters — it
 * sits between every query parameter of a signed URL — but a file NAME can carry any
 * of the others, and a chip labelled `photo &#39;final&#39;.png` is its own small bug.
 */
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&#x2F;": "/",
  "&#47;": "/",
};

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|#39|#x27|#x2F|#47);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}

/**
 * A persisted message's attachments, made renderable — or `undefined` when there are
 * none, so a message without files is left byte-identical rather than given an empty
 * array that would re-render every chip list downstream.
 *
 * ⚠️ TRUST NOTHING IN THE SHAPE. This crosses a network boundary; a row missing its
 * `url` would render a chip that links nowhere.
 */
function decodeAttachments(files: AgentInputFile[] | undefined): AgentInputFile[] | undefined {
  if (!files?.length) return undefined;
  const decoded = files
    .filter((file) => file && typeof file.name === "string" && typeof file.url === "string")
    .map((file) => ({
      name: decodeEntities(file.name),
      url: decodeEntities(file.url),
      imageDescription: decodeEntities(file.imageDescription ?? file.name),
    }));
  return decoded.length ? decoded : undefined;
}

/**
 * Resolves once the project's dev app is served again (not the sandbox placeholder),
 * or after ~2 minutes regardless — the caller reloads the frame either way.
 */
async function waitForPreview(projectId: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`/api/preview/${encodeURIComponent(projectId)}/`, { cache: "no-store" });
      if (response.ok && !looksLikePlaceholder(await response.text())) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
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
   * synced or restored: the API starts the server itself and refuses the action with
   * `SERVER_NOT_READY`. `useServerWake` turns that refusal into a wait with a clock, and
   * `useServerBlocked` + `<ServerBlockedDialog>` turn it into a sentence the user can act
   * on. Both are lifted from totalum-platform unchanged — see the notes in those files.
   */
  const serverWake = useServerWake(projectId);

  /**
   * ═══⭐⭐⭐ TOUCHING THE PROJECT STARTS ITS SLEEPING SERVER ═════════════════
   *
   * A sandbox is archived after a spell of inactivity, and an archived project opens
   * onto a dead end: the preview is a cached snapshot, and the first real thing the
   * user does — send a prompt, save a file, publish, pull — comes back
   * `SERVER_NOT_READY` two or three minutes before it could have worked. Starting it
   * when they engage means that wait overlaps with them reading their project instead
   * of following it.
   *
   * ⚠️⚠️ MERELY OPENING THE PAGE IS NOT ENOUGH, and that is the whole point of the
   * latch. Opening a project is the cheapest thing a user does: a link from the
   * dashboard, a bookmark, a tab the browser restored, a glance at a preview. Starting
   * a server for each of those spends credits and minutes of machine time on something
   * nobody was going to use. The project has to be TOUCHED first.
   *
   * ⚠️ THE HEADER IS EXCLUDED ON PURPOSE — totalum-platform does the same. It is
   * scaffolding, not the project: the project name, the theme toggle, the menu,
   * Dashboard. Clicking those is usually how someone LEAVES, and waking a server on the
   * way out is the same waste in a costlier disguise.
   *
   * ⚠️ A ONE-WAY LATCH, HELD IN A REF AS WELL AS IN STATE. The ref is what the listener
   * reads, so it never has to re-subscribe; the state is what re-runs the start effect,
   * which is otherwise idle.
   */
  const workspaceTouched = useRef(false);
  const [touchedProject, setTouchedProject] = useState(false);

  // A different project has not been touched yet, whatever the last one had.
  useEffect(() => {
    workspaceTouched.current = false;
    setTouchedProject(false);
  }, [projectId]);

  const markWorkspaceTouched = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (workspaceTouched.current) return;
    // `closest`, not the event's own currentTarget: a click can land on any node inside
    // the header (an icon, inside a button, inside the menu trigger).
    if ((event.target as HTMLElement | null)?.closest?.("[data-workspace-header]")) return;
    workspaceTouched.current = true;
    setTouchedProject(true);
  }, []);
  const [openModal, setOpenModal] = useState<WorkspaceModal | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  /**
   * ⭐ DUPLICATE, FROM THE PROJECT MENU. The dialog is the dashboard's (export → create →
   * import behind one button) and it wants the names already in use to suggest a free
   * copy name, so the list is fetched when the menu entry is pressed, not on every load.
   */
  const [cloneOpen, setCloneOpen] = useState(false);
  const [takenNames, setTakenNames] = useState<ReadonlySet<string>>(() => new Set());
  const openClone = useCallback(async () => {
    const res = await vcaasApi.projects.list({ limit: 100 });
    if (res.ok && Array.isArray(res.data)) setTakenNames(new Set(res.data.map((p) => p.projectId)));
    setCloneOpen(true);
  }, []);
  const [figmaConnected, setFigmaConnected] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);

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
  const githubPulling = operation.kind === "githubPull";
  const restoringVersion = operation.kind === "restoreVersion";

  /**
   * ⭐ WHY A CONTROL IS REFUSED RIGHT NOW, IN WORDS. Every long operation is also
   * disabled while ITS OWN kind runs; this covers the case the disabled state cannot —
   * pressing "pull" during a publish — with the sentence the platform uses.
   */
  const operationBusyReason = operation.kind
    ? translate(OPERATION_COPY[operation.kind].blocked, {
        min: OPERATION_PROFILES[operation.kind].minMinutes,
        max: OPERATION_PROFILES[operation.kind].maxMinutes,
      })
    : null;
  const refuseWhileBusy = useCallback((): boolean => {
    if (!operationBusyReason) return false;
    toast.info(operationBusyReason);
    return true;
  }, [operationBusyReason]);

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
   * feature here, exactly as its inspector column implies — which is also why only the
   * desktop `<ChatPanel>` gets the pencil.
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

  // The errands, for the mobile menu: each opens a modal rather than a tab.
  const MODAL_ENTRIES: { id: WorkspaceModal | "logs"; label: string; icon: typeof Clock }[] = [
    { id: "versions", label: "Versions", icon: Clock },
    { id: "secrets", label: "Secrets", icon: Key },
    { id: "domain", label: "Custom domain", icon: Globe },
    { id: "github", label: "GitHub", icon: Github },
    { id: "figma", label: "Figma", icon: Figma },
    { id: "logs", label: "Logs", icon: Terminal },
  ];

  const [project, setProject] = useState<VcaasProject | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [activeTab, setActiveTab] = useState("preview");
  const [prompt, setPrompt] = useState("");
  /**
   * ⭐ THE COMPOSER'S ATTACHMENTS LIVE HERE, NOT IN `ChatPanel`, FOR TWO REASONS.
   * The mobile and desktop composers are BOTH mounted (one is hidden by CSS), so
   * panel-local state would give the two lists that drift apart — sending on one
   * would leave the chip on the other. And state on the page can be persisted, which
   * is what makes an attachment survive a reload; see `composer-attachments.ts`.
   *
   * ⚠️ THE PROJECT IS PART OF THE STATE, NOT JUST OF THE STORAGE KEY. This route
   * reuses the component when the id changes, so for one render the state still holds
   * the PREVIOUS project's files while `projectId` is already the new one. Tagging the
   * list with the project it belongs to is what stops that render from saving one
   * project's attachments under another's key, and from showing them for a moment.
   */
  const [attachments, setAttachments] = useState<{ projectId: string | null; files: AgentInputFile[] }>(
    { projectId: null, files: [] }
  );
  const attachedFiles = useMemo(
    () => (attachments.projectId === projectId ? attachments.files : EMPTY_ATTACHMENTS),
    [attachments, projectId]
  );
  const setAttachedFiles = useCallback((update: React.SetStateAction<AgentInputFile[]>) => {
    setAttachments((prev) => {
      const base = prev.projectId === projectId ? prev.files : EMPTY_ATTACHMENTS;
      return { projectId, files: typeof update === "function" ? update(base) : update };
    });
  }, [projectId]);
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
  const [diffSource, setDiffSource] = useState<DiffSource | null>(null);
  /**
   * ⭐ THE RUN PROGRESS BAR'S INPUTS, from `agent/status` — see `RunProgress`.
   * `expectedMinutes` is persisted per project so a reload resumes the bar on the
   * engine's estimate at once, instead of the generic ten minutes until the first poll.
   * (The start time needs no copy here: `useRunClock` keeps its own stamp.)
   */
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [expectedMinutes, setExpectedMinutesState] = useState<number | null>(null);
  const expectedMinutesKey = `totalum:run-expected:${projectId}`;
  const setExpectedMinutes = useCallback((value: number | null) => {
    setExpectedMinutesState(value);
    try {
      if (value) localStorage.setItem(expectedMinutesKey, String(value));
      else localStorage.removeItem(expectedMinutesKey);
    } catch { /* storage unavailable — the next poll brings it back */ }
  }, [expectedMinutesKey]);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(expectedMinutesKey));
      if (stored > 0) setExpectedMinutesState(stored);
    } catch { /* storage unavailable */ }
  }, [expectedMinutesKey]);

  const mountedRef = useRef(true);
  /** When the project was last read successfully — the "stale tab" effect's clock. */
  const lastProjectReadAt = useRef(Date.now());
  const sendingRef = useRef(false);
  const autoSentRef = useRef(false);
  // Guards the poll loop right after a new run is started: the server may still
  // report the PREVIOUS run's "done"/"idle" for a moment, and concluding on that
  // stale status would wipe the just-sent message and stop polling. We wait to
  // actually observe "init" before allowing a "done"/"idle" to conclude the run.
  const pendingRunRef = useRef(false);
  const runWaitPollsRef = useRef(0);
  // Attachments the user sent this session, in order. The conversation API
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
    if (res.ok && res.data && mountedRef.current) { lastProjectReadAt.current = Date.now(); setProject(res.data); setPreviewUrl(getPreviewUrlFromProject(res.data)); setPreviewCached(isCachedPreview(res.data)); return res.data; } return null;
  }
  async function fetchConversation(): Promise<void> {
    const res = await vcaasApi.agent.fullConversation(projectId);
    if (res.ok && res.data && mountedRef.current) setMessages(rehydrateAttachments(res.data.conversation || []));
  }
  /**
   * ═══⭐ THE ATTACHMENTS ON A PAST MESSAGE ════════════════════════════════════
   *
   * Two sources, and the session's own uploads win where both have something:
   *
   *  1. **What we sent this session** (`sentFilesRef`) — the exact URLs the upload
   *     endpoint returned, never round-tripped through the API, so never escaped.
   *  2. **What the API persisted** (`message.files`) — the only source that survives a
   *     reload, and the reason this function is no longer a no-op for a fresh tab.
   *
   * ⚠️ THE PERSISTED URL MUST BE ENTITY-DECODED OR IT 403s. See `ConversationMessage.files`.
   */
  function rehydrateAttachments(conversation: ConversationMessage[]): ConversationMessage[] {
    const pending = [...sentFilesRef.current];
    return conversation.map((m) => {
      if (m.author !== "user") return m;
      const idx = pending.findIndex((p) => p.message === m.message);
      if (idx !== -1) {
        const [match] = pending.splice(idx, 1);
        return { ...m, inputFiles: match.files };
      }
      const persisted = decodeAttachments(m.files);
      return persisted ? { ...m, inputFiles: persisted } : m;
    });
  }
  // Lightweight GitHub connection check — drives the green "connected" marks.
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
      if (res.data.status === "init") {
        pendingRunRef.current = false; runWaitPollsRef.current = 0;
        // The progress bar's inputs — only from a RUNNING status, never the previous run's.
        const started = res.data.startedAt ? Date.parse(res.data.startedAt) : NaN;
        setRunStartedAt(Number.isNaN(started) ? null : started);
        const expected = res.data.expectedMinutes;
        setExpectedMinutes(typeof expected === "number" && expected > 0 ? expected : null);
      }
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
        setRunStartedAt(null); setExpectedMinutes(null);
        const proj = await fetchProject(); await fetchConversation();
        if (proj && mountedRef.current) setPreviewKey((k) => k + 1); return;
      }
    }
    pollingRef.current = setTimeout(pollAgentOnce, 10000);
  }
  /**
   * ⚠️ A PUBLISH TAKES THE DEV PREVIEW DOWN: the backend stops `npm start` for the
   * production build and restarts it at the end (success AND failure), so the frame was
   * left on a dead page until a browser refresh. Once the app answers, do what that did.
   */
  function reloadPreviewAfterPublish() {
    void waitForPreview(projectId).then(() => {
      if (!mountedRef.current) return;
      void fetchProject();
      setPreviewKey((k) => k + 1);
    });
  }
  async function pollDeployOnce() {
    if (!mountedRef.current) return;
    const res = await vcaasApi.deployments.status(projectId);
    if (!mountedRef.current) return;
    if (res.ok && res.data) {
      if (res.data.status === "success" || res.data.status === "error") reloadPreviewAfterPublish();
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
      const [proj, , , rebuildStatus] = await Promise.all([fetchProject(), fetchConversation(), fetchGithubStatus(), vcaasApi.rebuild.status(projectId)]);
      if (cancelled) return; setLoading(false);
      if (proj?.agentProcessStatus === "init") startAgentPolling();
      if (proj?.deployment?.status === "deploying") { setDeploying(true); pollDeployOnce(); }
      /**
       * ⭐ A REBUILD THE SERVER IS RUNNING AND WE HAVE NO STAMP FOR. A visual apply (or a
       * file save) starts a rebuild on the server; until now the only record of it was
       * the `localStorage` stamp written by the tab that pressed Save. Reload mid-rebuild
       * and the workspace looked idle over a dev server being replaced. Adopting it here
       * restores the banner, and the watcher below settles it — same as the platform.
       */
      if (shouldAdoptServerRebuild(rebuildStatus.ok ? rebuildStatus.data?.status : null, operation.current())) {
        operation.adopt("rebuild");
      }
      /**
       * ⭐⭐ AN IMPORT IS ADOPTED WITH THE SERVER'S OWN CLOCK, AND IT OUTRANKS THE REST.
       * `importInProgress` is a lock held and dated by the server, so a clone that was
       * started in the dashboard (which stamps the slot and navigates here) — or in
       * another tab, or before a reload — shows the overlay on the first frame and keeps
       * the true elapsed time. Upstream refuses every other long operation while it is
       * set, so whatever a local stamp claims is in flight, it is not.
       */
      if (proj?.importInProgress) {
        operation.adopt("import", Date.parse(proj.importInProgress.startedAt) || undefined);
      }
    }
    init(); return () => { cancelled = true; stopAgentPolling(); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * ⚠️ FIGMA'S STATUS IS READ ON MOUNT, NOT WHEN THE MODAL OPENS. `FigmaModal` only
   * loads while `open`, so without this the composer's Figma button read "not connected"
   * on every fresh workspace until someone happened to open the dialog. No `verify`: that
   * spends a live call against Figma's API to answer a question a tint does not ask.
   */
  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await vcaasApi.figma.status(projectId);
      if (active && response.ok && response.data) setFigmaConnected(!!response.data.connected);
    })();
    return () => { active = false; };
  }, [projectId]);

  /**
   * ⭐ DISCONNECT FIGMA FROM THE COMPOSER, without opening the modal. It RETHROWS on
   * failure: `FigmaPromptButton` awaits this and keeps its popover open — still showing
   * "connected" — when it rejects, instead of closing on a disconnect that did not happen.
   */
  const handleDisconnectFigma = useCallback(async () => {
    const response = await vcaasApi.figma.disconnect(projectId);
    if (!response.ok) {
      toast.error(translate("workspace.figma.disconnectFailed"), { description: response.error || undefined });
      throw new Error(response.error || "figma disconnect failed");
    }
    setFigmaConnected(false);
    toast.success(translate("workspace.figma.disconnected"));
  }, [projectId]);

  // Core send routine — accepts an explicit prompt text so it can be driven both
  // by the chat input and by the auto-submit flow (a project just created from the
  // dashboard whose first prompt is carried over via sessionStorage).
  const sendPromptText = useCallback(async (text: string, files?: { name: string; url: string; imageDescription: string }[], options?: AgentRunOptions) => {
    if ((!text.trim() && (!files || files.length === 0)) || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const hasFiles = !!files && files.length > 0;
    if (hasFiles) sentFilesRef.current.push({ message: text, files: files! });
    setMessages((prev) => [...prev, { author: "user", message: text, messageType: "regular", createdAt: new Date().toISOString(), inputFiles: hasFiles ? files : undefined }]);
    setPrompt("");
    /**
     * ⚠️ ONLY WHAT THE USER CHOSE IS SENT. `options` is `{}` unless the run-options menu
     * was touched, so Totalum's own model/effort routing stays in charge by default.
     */
    const res = await vcaasApi.agent.start(projectId, { prompt: text, inputFiles: files || [], ...(options || {}) });
    if (res.ok) {
      setProject((prev) => prev ? { ...prev, agentProcessStatus: "init" } : prev);
      pendingRunRef.current = true; runWaitPollsRef.current = 0;
      // A new run: the previous run's estimate must not show while the first poll is out.
      setRunStartedAt(null); setExpectedMinutes(null);
      startAgentPolling();
    } else {
      /**
       * ═══⭐⭐ A REFUSED PROMPT PUTS EVERYTHING BACK ═══════════════════════════
       *
       * ⚠️ THE OPTIMISTIC MESSAGE MUST GO. Leaving it would show the agent an
       * instruction it never received — the user would sit watching for a reply to a
       * prompt that was never accepted.
       *
       * ⚠️ AND THE PROMPT ITSELF COMES BACK TO THE BOX, with its attachments. The
       * answer to a sleeping server is "press send again in a minute", which is
       * impossible if sending emptied the composer.
       */
      setMessages((prev) => prev.slice(0, -1));
      if (hasFiles) sentFilesRef.current.pop();
      setPrompt(text);
      if (hasFiles) setAttachedFiles(files!);

      /**
       * ⭐⭐ THE SERVER WAS ASLEEP, SO THE API STARTED IT AND REFUSED THE PROMPT.
       * That is not a failure and must not read as one: `claim` turns the refusal into
       * the wake strip with its clock, and tells the user the moment they can send.
       * Publish, pull and restore already did this; the composer was the one action
       * still answering a sleeping server with a red error.
       */
      if (serverWake.claim(res, () => toast.success(translate("workspace.serverWake.readyFor", { action: translate("workspace.serverWake.actionSendPrompt") })))) {
        setSending(false);
        sendingRef.current = false;
        return;
      }

      toast.error(res.error || "Failed to start agent");
    }
    setSending(false);
    sendingRef.current = false;
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendPrompt = async (files?: { name: string; url: string; imageDescription: string }[], options?: AgentRunOptions) => {
    if (project?.agentProcessStatus === "init") return;
    await sendPromptText(prompt, files, options);
  };

  /**
   * ═══⭐⭐ THE AUTOMATIC START ITSELF ═══════════════════════════════════════
   *
   * Every guard below rules the start out from a different angle, and all of them have
   * to agree. This mirrors totalum-platform's effect in `WorkspaceShell`.
   *
   * ⚠️ `Archived` ONLY. Not `Archiving` (on its way down, startable in a moment), not
   * the in-transition states (already coming up), and NOT a missing `agentServerStatus`
   * — an absent field is far more likely to be a partial read than a dead VM, and
   * spending credits on that guess, unprompted, is the wrong way to be wrong. A
   * genuinely dead sandbox still self-heals on the first real action the user takes.
   *
   * ⚠️ NOT WHILE ANYTHING ELSE OWNS THE SANDBOX. A project created moments ago has no
   * sandbox yet and its first prompt is already creating one; firing a second start
   * into that is wasted at best.
   *
   * ⚠️ ONCE PER PROJECT PER MOUNT, via the ref. A reload can still fire it again, and
   * that is free: the API refuses without charging while a sandbox is `Unarchiving`,
   * and `claim` renders that refusal as the same wait strip.
   */
  const autoStartedFor = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !project) return;
    if (autoStartedFor.current === projectId) return;

    // ⚠️ Nothing starts until the user engages with the project — see the latch above.
    if (!touchedProject) return;

    // Anything already in motion owns the sandbox; do not touch it.
    // (`isBuilding` is exactly this status check, and is declared further down.)
    if (operation.kind || project.agentProcessStatus === "init") return;

    // A wake is already in flight; a second start would cost a credit for nothing.
    if (serverWake.waking) return;

    /**
     * ⚠️⚠️ `Archived` OR NO SERVER AT ALL. Production answers a sleeping project with NO
     * `agentServerStatus` (checked 2026-09-14), so requiring exactly `Archived` meant a
     * click never started anything and the wake strip never appeared. A missing status
     * counts only when upstream ALSO recommends the archive snapshot — its own statement
     * that no live server exists — so a partial read still starts nothing.
     */
    if (!hasNoLiveServer(project)) return;

    // ⚠️ PROOF THE PROJECT HAS EVER BEEN BUILT. A conversation with no user message has
    // never had a prompt run against it, so there is nothing archived worth restoring.
    if (!messages.some((message) => message.author === "user")) return;

    autoStartedFor.current = projectId;

    void (async () => {
      const res = await vcaasApi.agent.restartServer(projectId);
      if (!mountedRef.current) return;

      /**
       * ⚠️ THE SUCCESS PATH IS THE ONE THAT NEEDS THE STRIP. `start-or-restart` answers
       * a 200, so `claim` — which only recognises `SERVER_NOT_READY` — would never see
       * it. Enter the wait directly, with no retry callback: nothing was refused, so
       * there is nothing to redo. When it is up, show the live app instead of the
       * snapshot the frame has been serving.
       */
      if (res.ok) {
        serverWake.begin(() => { void fetchProject(); setPreviewKey((k) => k + 1); });
        return;
      }

      // Somebody else got there first, or it is already starting: same strip, silently.
      // ⚠️ `silent` — THE USER PRESSED NOTHING, so the dialog that answers a refused
      // button press would here be thrown at somebody who has just arrived.
      if (serverWake.claim(res, undefined, { silent: true })) return;

      /**
       * ⚠️ A REAL FAILURE IS SWALLOWED, DELIBERATELY. They asked to open their project,
       * not to start a server. A red toast about a start they never requested is noise,
       * and every action they might take next starts it again and reports properly.
       */
      console.warn("[workspace] auto server start refused:", res.code || res.error);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, project, projectId, touchedProject, operation.kind, messages, serverWake]);

  /**
   * ═══⭐⭐ THE STALE TAB — RE-READ THE PROJECT WHEN THE USER COMES BACK ═══════════════
   *
   * A tab left open for hours outlives its server: the hourly archive job puts it to sleep
   * and nothing re-reads the project, so the preview kept its dead live url and showed
   * Cloudflare's "not available" page until a manual refresh. When the user returns (tab
   * visible, window focus, a click — `blur` catches a click INTO the preview frame) and the
   * last read is older than `STALE_PROJECT_MS`, re-read it: `fetchProject` recomputes the
   * preview url, so a snapshot recommendation swaps the frame by itself.
   *
   * ⚠️ WHEN THE SERVER TURNS OUT TO BE GONE, the touch latch and `autoStartedFor` are
   * re-armed: only a click on the project (not the header) may start the server — tabbing
   * back must not spend credits — and a wake earlier in this load must not block the next.
   */
  useEffect(() => {
    if (loading) return;
    let inFlight = false;

    const recheck = async (event?: Event) => {
      if (inFlight || document.hidden) return;
      if (Date.now() - lastProjectReadAt.current < STALE_PROJECT_MS) return;
      if (operation.kind || project?.agentProcessStatus === "init") return;

      inFlight = true;
      const hadLiveServer = !!project && !hasNoLiveServer(project);
      const detail = await fetchProject();
      inFlight = false;
      if (!mountedRef.current || !detail) return;
      if (!hadLiveServer || !hasNoLiveServer(detail)) return;

      const target = event?.type === "pointerdown" ? (event.target as HTMLElement | null) : null;
      const touched = !!target && !target.closest?.("[data-workspace-header]");
      workspaceTouched.current = touched;
      setTouchedProject(touched);
      autoStartedFor.current = null;
    };

    const onVisibility = () => void recheck();
    const onWindowEvent = (event: Event) => void recheck(event);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onWindowEvent);
    window.addEventListener("blur", onWindowEvent);
    window.addEventListener("pointerdown", onWindowEvent, true);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onWindowEvent);
      window.removeEventListener("blur", onWindowEvent);
      window.removeEventListener("pointerdown", onWindowEvent, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, project, operation.kind]);

  /**
   * ⭐ ATTACHMENTS SURVIVE A RELOAD. Read on arrival, written on every change. Both
   * effects are no-ops until the state is tagged with THIS project, which is what keeps
   * the first render after a project switch from writing the previous one's list.
   */
  useEffect(() => {
    setAttachments({ projectId, files: loadAttachments(projectId) });
  }, [projectId]);

  useEffect(() => {
    if (attachments.projectId !== projectId) return;
    saveAttachments(projectId, attachments.files);
  }, [projectId, attachments]);

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
   * what people do while they wait — and now that GitHub and versions are DIALOGS, it is
   * what closing one does. One watcher on the page, keyed on the slot, survives modal
   * closes, tab switches and (because the record is persisted) page reloads.
   *
   * ⚠️ IT IS BOUNDED. A job that stops reporting must not leave the banner up for the rest
   * of the session, so the watch gives up after `MAX_WATCH_ATTEMPTS` and says it stopped
   * watching rather than claiming a failure it did not observe.
   *
   * ⚠️ `publish` IS NOT HERE — the deploy poll below owns it, and two watchers on one job
   * is how a banner gets cleared while the work is still running. `rebuild` IS here: the
   * Code panel's poll dies with the panel, and a visual apply starts a rebuild with no
   * panel at all, so this is the watch that survives a tab switch and a reload.
   */
  useEffect(() => {
    const kind = operation.kind;
    if (!kind || kind === "publish") return;

    const MAX_WATCH_ATTEMPTS = 60; // 60 × 8s = 8 minutes
    let cancelled = false;
    let attempts = 0;
    let idleSeen = 0;
    /** Import only: whether the lock was ever seen, and when it was seen to clear. */
    let sawImporting = false;
    let importClearedAt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    /**
     * ⚠️ A 200 IS NOT ENOUGH. While the server is down the sandbox serves its own
     * "preview building, expired or broken" page with a perfectly good status code.
     * `looksLikePlaceholder` is the platform's check, copied, so there is one definition
     * of "that is not your app".
     */
    const appIsServing = async (): Promise<boolean> => {
      try {
        const response = await fetch(`/api/preview/${encodeURIComponent(projectId)}/`, { cache: "no-store" });
        if (!response.ok) return false;
        return !looksLikePlaceholder(await response.text());
      } catch {
        return false; // indistinguishable from "not up yet"
      }
    };

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

      if (kind === "rebuild") {
        const status = await vcaasApi.rebuild.status(projectId);
        if (cancelled) return;
        if (status.ok && status.data?.status === "success") return finish(translate("workspace.code.rebuildDone"));
        if (status.ok && status.data?.status === "error") { toast.error(status.data.errorMessage || translate("workspace.code.rebuildFailed")); return finish(); }
        // `idle` means "never rebuilt here", not "finished" — believe it only once the job
        // has had a few polls to appear, and then give up rather than claim success.
        if (status.ok && status.data?.status === "idle" && ++idleSeen >= IDLE_POLLS_BEFORE_GIVING_UP) { operation.end(kind); return; }
      }

      if (kind === "githubPull") {
        const status = await vcaasApi.github.pullStatus(projectId);
        if (cancelled) return;
        if (status.ok && status.data && status.data.status !== "pulling") {
          return finish(status.data.status === "error" ? undefined : "Pulled from GitHub");
        }
      }

      /**
       * ⭐ IMPORT — the platform's rule, verbatim: the server's lock must clear, then
       * the sandbox must be `Active` AND serving the project's own app. If the lock was
       * never seen at all, give it a few polls to appear before believing "not running".
       * Once the lock has cleared, a bounded grace covers the cold build, after which the
       * import is a success either way — it DID finish; only the preview is late.
       */
      if (kind === "import") {
        const detail = await vcaasApi.projects.get(projectId);
        if (cancelled) return;
        if (detail.ok && detail.data) {
          if (detail.data.importInProgress) {
            sawImporting = true;
            importClearedAt = 0;
          } else if (sawImporting || ++idleSeen >= IDLE_POLLS_BEFORE_GIVING_UP || importClearedAt !== 0) {
            if (importClearedAt === 0) importClearedAt = Date.now();
            const graceExpired = Date.now() - importClearedAt > IMPORT_PREVIEW_GRACE_MS;
            if ((detail.data.agentServerStatus === "Active" && (await appIsServing())) || graceExpired) {
              if (cancelled) return;
              return finish(translate("workspace.operation.import.succeeded"));
            }
          }
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
   * ⭐⭐ THE PENCIL — refused, with the reason, rather than opened over a document it
   * cannot edit; see `visualEditBlockedReason`. Lives in the composer's tool tray now (the
   * platform's placement), so this is the one handler the tray calls.
   */
  const handleToggleVisualEdit = useCallback(() => {
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
  }, [visualEditorOpen, visualEditBlockedReason, blocked]);

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

  /**
   * ═══⭐⭐ WHEN THE REBUILD THE EDITOR STARTED FINISHES ═════════════════════
   *
   * The apply route writes the files and starts a rebuild, and the hook parks in
   * `rebuilding` until SOMEONE tells it the rebuild ended. In the platform that someone
   * is this effect in `WorkspaceShell`; it was never copied here, so the bar's loader ran
   * for ever and only a manual reload showed the change. Copied now, verbatim apart from
   * the preview key, plus one line that stamps the operation slot so the banner (and a
   * reload — see the adoption in `init`) knows a rebuild is running.
   *
   * ⭐ "SUCCESS" IS NOT "THE APP IS SERVING". The platform measured rebuilds that
   * reported success and then served 503 for minutes; reloading the frame on that answer
   * drops the user into a dead page. So the preview is probed before declaring victory.
   *
   * ⚠️ `visual` IS DELIBERATELY NOT A DEPENDENCY — it is a fresh object every render and
   * would restart this timer on every poll tick. The two callbacks are stable.
   */
  const visualFinishRebuild = visual.finishRebuild;
  const visualFailRebuild = visual.failRebuild;
  useEffect(() => {
    if (visual.phase !== "rebuilding") return;
    if (!operation.isActive("rebuild")) operation.begin("rebuild");

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    let idleSeen = 0;

    const previewAnswers = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < PREVIEW_PROBE_ATTEMPTS; attempt++) {
        if (cancelled) return false;
        try {
          const response = await fetch(`/api/preview/${encodeURIComponent(projectId)}/`, { method: "HEAD", cache: "no-store" });
          if (response.ok) return true;
        } catch {
          // Network hiccup — indistinguishable from "not up yet", so retry.
        }
        await new Promise(resolve => setTimeout(resolve, PREVIEW_PROBE_INTERVAL_MS));
      }
      return false;
    };

    const settle = async (outcome: "success" | "error", code?: string) => {
      if (cancelled) return;
      operation.end("rebuild");
      if (outcome === "error") { visualFailRebuild(code || "REBUILD_FAILED"); return; }
      const alive = await previewAnswers();
      if (cancelled) return;
      if (!alive) { visualFailRebuild("REBUILD_OK_APP_DOWN"); return; }
      visualFinishRebuild();
      fetchProject();
      setPreviewKey(value => value + 1);
    };

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt > REBUILD_POLL_TIMEOUT_MS) { operation.end("rebuild"); visualFailRebuild("REBUILD_TIMEOUT"); return; }

      const response = await vcaasApi.rebuild.status(projectId);
      if (cancelled) return;
      if (!response.ok) { timer = setTimeout(poll, REBUILD_POLL_INTERVAL_MS); return; }

      const status = response.data?.status ?? null;
      if (status === "success") { void settle("success"); return; }
      if (status === "error") { void settle("error", "REBUILD_FAILED"); return; }
      if (status === "idle" && ++idleSeen >= IDLE_POLLS_BEFORE_GIVING_UP) { operation.end("rebuild"); visualFailRebuild("REBUILD_NOT_FOUND"); return; }

      timer = setTimeout(poll, REBUILD_POLL_INTERVAL_MS);
    };

    timer = setTimeout(poll, REBUILD_POLL_INTERVAL_MS);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [visual.phase, projectId, visualFinishRebuild, visualFailRebuild]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (deploying) return;
    if (refuseWhileBusy()) return;
    setDeploying(true);
    const res = await vcaasApi.deployments.deploy(projectId);

    /**
     * ⭐ THE SERVER WAS ASLEEP, SO THE API STARTED IT AND REFUSED THE PUBLISH. Not a
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

  /**
   * ⭐ PULL FROM GITHUB — THE PAGE'S, NOT THE MODAL'S OR THE POPOVER'S. Both of those
   * unmount (the popover on every click, the modal on close), and a pull runs for
   * minutes. The request, the banner and the watcher above belong to the operation slot.
   *
   * ⚠️ `no_changes` IS NOT AN OPERATION. Upstream answers it synchronously when the
   * repository is already in step — nothing runs, nothing needs watching.
   */
  const handleGithubPull = useCallback(async () => {
    if (refuseWhileBusy()) return;
    const res = await vcaasApi.github.pull(projectId);

    /** ⭐ A pull rewrites the project's files on the sandbox, so it needs one running. */
    if (serverWake.claim(res, () => toast.success(translate("workspace.serverWake.readyFor", { action: translate("workspace.serverWake.actionPull") })))) return;

    if (!res.ok) {
      toast.error(translate("workspace.github.pullFailed"), { description: res.error || undefined });
      return;
    }
    if (res.data?.status === "no_changes") {
      toast.info(translate("workspace.github.pullNoChanges"));
      return;
    }
    toast.success(translate("workspace.github.pulling"), {
      description: translate("workspace.operation.githubPull.description", {
        min: OPERATION_PROFILES.githubPull.minMinutes,
        max: OPERATION_PROFILES.githubPull.maxMinutes,
      }),
    });
    operation.begin("githubPull");
  }, [projectId, refuseWhileBusy, serverWake, operation]);

  /**
   * ⭐ RESTORE A PAST VERSION — the versions modal's confirmation.
   *
   * ⚠️ IT THROWS ON FAILURE. `ConfirmDialog` keeps itself open and honest that way;
   * swallowing the error would close the dialog as if the restore had been accepted.
   *
   * ⚠️⚠️ AND IT NEVER REPLAYS ITSELF after a wake: a restore overwrites the project's
   * files, and the dialog that authorised it closed minutes ago. The wake tells the user
   * when they can press it again; pressing it stays their decision.
   */
  const handleRestoreVersion = useCallback(async (version: ProjectVersion) => {
    if (refuseWhileBusy()) return;
    const res = await vcaasApi.versions.recover(projectId, version._id);

    if (serverWake.claim(res, () => toast.success(translate("workspace.serverWake.readyFor", { action: translate("workspace.serverWake.actionRestore") })))) {
      toast.info(translate("workspace.serverWake.title"), { description: translate("workspace.serverWake.bodyRetry") });
      throw new Error(res.code || "server not ready");
    }
    if (!res.ok) {
      toast.error(translate("workspace.versions.restoreFailed"), { description: res.error || undefined });
      throw new Error(res.error || "restore failed");
    }
    toast.success(translate("workspace.versions.restoreStarted", { name: version.name }), {
      description: translate("workspace.operation.restoreVersion.description", {
        min: OPERATION_PROFILES.restoreVersion.minMinutes,
        max: OPERATION_PROFILES.restoreVersion.maxMinutes,
      }),
    });
    operation.begin("restoreVersion");
  }, [projectId, refuseWhileBusy, serverWake, operation]);

  /**
   * ⭐ EVERY STORED PATCH IN THE CONVERSATION, BY THE VERSION IT PRODUCED. A run's
   * `finished` message carries both `gitDiffUrl` and `versionId`; the versions list knows
   * the commit but not the patch. This index lets version history use the STORED patch —
   * the route that works with the project asleep — and fall back to the commit only when
   * it has to. See `DiffSource` in `DiffViewer.tsx`.
   */
  const storedPatchByVersion = useMemo(() => {
    const index = new Map<string, string>();
    for (const message of messages) {
      if (message.versionId && message.gitDiffUrl) index.set(message.versionId, message.gitDiffUrl);
    }
    return index;
  }, [messages]);
  const storedPatchFor = useCallback((versionId: string) => storedPatchByVersion.get(versionId), [storedPatchByVersion]);
  const openVersionDiff = useCallback((version: ProjectVersion) => {
    setDiffSource({
      projectId,
      url: storedPatchFor(version._id),
      commitSha: version.commitSha,
      versionId: version._id,
    });
  }, [projectId, storedPatchFor]);

  const openEntry = (id: WorkspaceModal | "logs") => {
    if (id === "logs") setLogsOpen(true);
    else setOpenModal(id);
  };

  const isBuilding = project?.agentProcessStatus === "init";
  /**
   * ═══⭐ THE FIRST BUILD SHOWS THE LOADER, NEVER THE TEMPORAL PREVIEW ═════════
   *
   * ⚠️⚠️ VCaaS PUBLISHES `temporalDevelopmentProjectUrl` AS SOON AS THE SANDBOX EXISTS,
   * minutes before the very first build serves anything. So on the FIRST prompt, a page
   * reload would set `previewUrl` from that link and point an iframe at a server that is
   * not up yet — the user watching their first build gets a broken preview instead of the
   * loader. A not-yet-built app is the EXPECTED state during the first run, not an error.
   *
   * "Has never completed a build" = the conversation carries no `finished` message. It is
   * refetched on every load (the page's full-screen `loading` gate holds render until the
   * conversation has resolved), so this is reload-proof. ONLY the first build: a follow-up
   * run has a prior `finished` message, so it keeps showing the existing preview while it
   * rebuilds. And it self-releases anyway the moment `isBuilding` turns false.
   */
  const isFirstBuild = isBuilding && !messages.some((m) => m.messageType === "finished");
  const shownPreviewUrl = isFirstBuild ? null : previewUrl;
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
      {/* Tabs - visible on mobile only */}
      <div className="sm:hidden border-t py-1" style={{ borderColor: darkMode ? "#444" : "#eee" }}>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileTab("panel"); setMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${activeTab === tab.id ? "text-gray-900 dark:text-white font-medium" : "text-gray-700 dark:text-gray-200"}`}>
            <tab.icon className="w-4 h-4 text-gray-400" /> {tab.label}
          </button>
        ))}
      </div>
      {/* The errands — each opens a dialog over the workspace */}
      <div className="border-t py-1" style={{ borderColor: darkMode ? "#444" : "#eee" }}>
        {MODAL_ENTRIES.map((entry) => {
          const connected = (entry.id === "github" && githubConnected) || (entry.id === "figma" && figmaConnected);
          return (
            <button key={entry.id} onClick={() => { openEntry(entry.id); setMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200">
              <span className="relative flex items-center">
                <entry.icon className="w-4 h-4 text-gray-400" />
                {connected && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1e1e1e]" />}
              </span>
              <span className="flex-1 text-left">{entry.label}</span>
              {connected && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{"Connected"}</span>}
            </button>
          );
        })}
        <button onClick={() => { setMenuOpen(false); void openClone(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200">
          <Copy className="w-4 h-4 text-gray-400" /> {"Duplicate project"}
        </button>
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

  // The chat's composer props that both layouts share — the tool tray's wiring.
  const composerProps = {
    attachedFiles,
    setAttachedFiles,
    onOpenFigma: () => setOpenModal("figma"),
    figmaConnected,
    onDisconnectFigma: handleDisconnectFigma,
    onOpenGithub: () => setOpenModal("github"),
    onGithubStatusChange: setGithubConnected,
    onGithubPull: () => void handleGithubPull(),
    githubPulling,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden dark:text-gray-200" style={{ background: pageBg }} onClickCapture={markWorkspaceTouched}>
      {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize" />}

      {/* ═══ DESKTOP LAYOUT ═══ */}
      <div className="hidden sm:flex flex-col h-full">
        {/* Desktop header 48px */}
        <header data-workspace-header className="flex items-stretch shrink-0 z-10" style={{ height: 48 }}>
          {/* LEFT: aside width */}
          <div className="flex items-center gap-1.5 px-3 shrink-0" style={{ width: typeof leftHeaderWidth === "number" ? leftHeaderWidth : undefined }}>
            <Link href="/" title={"Back"} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="relative flex-1 min-w-0" ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1.5 max-w-full rounded-lg px-1.5 py-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <div className="w-5 h-5 rounded bg-gray-900 dark:bg-white flex items-center justify-center shrink-0"><Sparkles className="w-2.5 h-2.5 text-white dark:text-gray-900" /></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{project.label || projectId}</span>
                <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
              </button>
              {popupMenu}
            </div>
            <button onClick={() => setOpenModal("versions")} className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors shrink-0 border ${btnBorder} text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10`} title={translate("workspace.versions.title")}>
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
                {/* ⭐ Logs open as a dialog from the address bar — the platform's placement. */}
                <button onClick={() => setLogsOpen(true)} className="p-1 rounded shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title={translate("workspace.logs.title")}><Terminal className="w-3.5 h-3.5" /></button>
                <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-600 shrink-0" />
                <button onClick={() => setMobilePreview(!mobilePreview)} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">{mobilePreview ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}</button>
                {/*
                  ⭐ THE ADDRESS BOX LISTS THE PROJECT'S OWN PAGES. It was a bare text
                  input, so reaching any page but `/` meant knowing its URL by heart.
                  `PathPicker` (the platform's, copied) reads the file tree — free, not
                  the charged source download — turns the route files into a list, and
                  filters it as you type; picking one navigates the preview.
                */}
                <PathPicker
                  projectId={projectId}
                  path={iframePath}
                  onPathChange={setIframePath}
                  onRefresh={() => setPreviewKey((k) => k + 1)}
                  className="flex-1 min-w-0"
                />
                <button className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0" onClick={() => { fetchProject(); setPreviewKey((k) => k + 1); }}><RefreshCw className="w-3.5 h-3.5" /></button>
                {previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>}
              </div>
            </div>
            {/*
              ⭐ THE HEADER KEEPS ONLY WHAT IS NOT A PROMPT TOOL: Secrets and Publish.
              GitHub, Figma and the visual editor moved into the composer's tool tray
              (see `ChatPanel`), where the platform puts them — they act on what you are
              about to type, so they sit next to where you type it.
            */}
            <button onClick={() => setOpenModal("secrets")} className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors shrink-0 border ${btnBorder} text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10`} title={translate("workspace.secrets.title")}>
              <Key className="w-3.5 h-3.5" />
            </button>
            {/*
              ⭐⭐ PUBLISH — the platform's control: the button, the dialog that says what
              publishing does (public address, ~3 minutes, 1 credit) and the custom-domain
              row with its DNS-propagation notice. Copied unchanged from totalum-platform.
            */}
            <DeployControl
              projectId={projectId}
              project={project}
              isDeploying={deploying}
              isRunning={isBuilding}
              blockedReason={deploying ? null : operationBusyReason}
              onDeploy={handleDeploy}
              onOpenDomain={() => setOpenModal("domain")}
            />
          </div>
        </header>
        {/* Desktop main */}
        <div className="flex-1 flex overflow-hidden">
          <div className={`flex flex-col shrink-0 transition-all ${chatCollapsed ? "w-0 overflow-hidden" : ""}`} style={chatCollapsed ? {} : { width: chatWidth, background: cardBg }}>
            <ChatPanel
              messages={messages} isBuilding={isBuilding} prompt={prompt} setPrompt={setPrompt} onSend={handleSendPrompt} onStop={handleStopAgent} sending={sending} projectId={projectId} projectSecrets={project?.secrets}
              runStartedAt={runStartedAt} expectedMinutes={expectedMinutes}
              {...composerProps}
              visualEditAvailable
              visualEditActive={visualEditorOpen}
              visualEditBusy={visualLocked}
              onToggleVisualEdit={handleToggleVisualEdit}
            />
          </div>
          {!chatCollapsed && (
            <div className="flex w-1 hover:w-1.5 bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 cursor-col-resize transition-all items-center justify-center shrink-0" onMouseDown={handleResizeStart}>
              <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-600 rounded-full" />
            </div>
          )}
          <div className="flex-1 flex flex-col min-w-0">
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
            {/*
              ⭐ THE WAKE STRIP, ABOVE THE PANEL THAT OWNS THE ACTION. It is a strip in the
              panel column, never an overlay, so the rest of the workspace stays usable
              while the server comes up — the dialog is the interruption, this is the progress.
            */}
            {(serverWake.waking || serverWake.failed) && (
              <div className="px-2 pt-2 sm:px-3">
                <ServerWakeNotice wake={serverWake} manualRetry={!serverWake.willRetry} />
              </div>
            )}
            <div className={`flex-1 overflow-hidden ${activeTab === "preview" ? "rounded-none" : "m-2 sm:m-3 rounded-xl shadow-sm"}`} style={{ background: cardBg }}>
              {activeTab === "preview" && <PreviewPanel key={previewKey} previewUrl={shownPreviewUrl} cached={previewCached} onRefresh={() => { fetchProject(); setPreviewKey((k) => k + 1); }} loading={isBuilding} mobilePreview={mobilePreview} iframePath={iframePath} frameRef={previewFrameRef} /* ⭐ Same-origin ONLY while the editor is open — and for the length of an apply, which outlives the panel: dropping the proxy mid-apply would reload the frame and throw away the preview-only edits the user is watching. */ proxiedSrc={visualEditorOpen || visualLocked ? `/api/preview/${encodeURIComponent(projectId)}` : null} />}
              {activeTab === "code" && <CodePanel projectId={projectId} darkMode={darkMode} onAskAiEdit={handleAskAiEdit} wake={serverWake} onRebuildStarted={() => operation.begin("rebuild")} onRebuildFinished={() => operation.end("rebuild")} />}
              {activeTab === "database" && <DatabasePanel projectId={projectId} />}
            </div>
            {/* The unsaved-changes bar owns the whole batch: count, undo, discard and apply. */}
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
        <header data-workspace-header className="flex items-center gap-1 px-2 shrink-0 z-10" style={{ height: 44 }}>
          <Link href="/" title={"Back"} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <div className="w-5 h-5 rounded bg-gray-900 dark:bg-white flex items-center justify-center shrink-0"><Sparkles className="w-2.5 h-2.5 text-white dark:text-gray-900" /></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[160px]">{project.label || projectId}</span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>
            {popupMenu}
          </div>
        </header>

        {/*
          ⭐ THE WAKE STRIP ON MOBILE, ABOVE BOTH TABS. The desktop strip lives in the
          panel column, which on a phone is a SEPARATE VIEW from the chat — so a server
          started from the composer came up with no visible sign of it anywhere. Here it
          sits above the switch, so the wait is on screen whichever tab is open.
        */}
        {(serverWake.waking || serverWake.failed) && (
          <div className="shrink-0 px-2 pt-2">
            <ServerWakeNotice wake={serverWake} manualRetry={!serverWake.willRetry} />
          </div>
        )}

        {/* Mobile content area */}
        <div className="flex-1 overflow-hidden" style={{ background: cardBg }}>
          {mobileTab === "chat" ? (
            <div className="flex flex-col h-full">
              {/* ⚠️ No pencil here: the visual editor is a desktop surface (see the frame-ref note). */}
              <ChatPanel messages={messages} isBuilding={isBuilding} prompt={prompt} setPrompt={setPrompt} onSend={handleSendPrompt} onStop={handleStopAgent} sending={sending} projectId={projectId} projectSecrets={project?.secrets} runStartedAt={runStartedAt} expectedMinutes={expectedMinutes} {...composerProps} />
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              {activeTab === "preview" && <PreviewPanel key={previewKey} previewUrl={shownPreviewUrl} cached={previewCached} onRefresh={() => { fetchProject(); setPreviewKey((k) => k + 1); }} loading={isBuilding} mobilePreview={false} iframePath={iframePath} />}
              {activeTab === "code" && <CodePanel projectId={projectId} darkMode={darkMode} onAskAiEdit={handleAskAiEdit} wake={serverWake} onRebuildStarted={() => operation.begin("rebuild")} onRebuildFinished={() => operation.end("rebuild")} />}
              {activeTab === "database" && <DatabasePanel projectId={projectId} />}
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
        refusal raised inside any dialog — the code editor, the GitHub modal, the versions
        list — is answered here without a single prop being threaded through.
      */}
      <ServerBlockedDialog reason={blocked.reason} onDismiss={blocked.dismiss} wake={serverWake} />
      <PublishedModal
        open={publishedHost !== null}
        onOpenChange={open => {
          if (!open) setPublishedHost(null);
        }}
        host={publishedHost ?? ""}
        hasCustomDomain={project.customDomain?.status === "active"}
        onOpenDomain={() => {
          setPublishedHost(null);
          setOpenModal("domain");
        }}
      />

      {/* ═══ THE ERRANDS — totalum-platform's dialogs, copied unchanged ═══ */}
      <VersionsModal
        open={openModal === "versions"}
        onOpenChange={open => setOpenModal(open ? "versions" : null)}
        projectId={projectId}
        onViewDiff={openVersionDiff}
        storedPatchFor={storedPatchFor}
        restoring={restoringVersion}
        onRestore={handleRestoreVersion}
        blockedReason={restoringVersion ? null : operationBusyReason}
      />
      <DiffViewer
        open={!!diffSource}
        onOpenChange={open => { if (!open) setDiffSource(null); }}
        source={diffSource}
      />
      <SecretsModal
        open={openModal === "secrets"}
        onOpenChange={open => setOpenModal(open ? "secrets" : null)}
        projectId={projectId}
        secrets={project.secrets ?? []}
        onChanged={() => void fetchProject()}
      />
      <DomainModal
        open={openModal === "domain"}
        onOpenChange={open => setOpenModal(open ? "domain" : null)}
        projectId={projectId}
        project={project}
        onChanged={() => void fetchProject()}
      />
      <GithubModal
        open={openModal === "github"}
        onOpenChange={open => setOpenModal(open ? "github" : null)}
        projectId={projectId}
        onStatusChange={setGithubConnected}
        /*
          ⭐ THE PULL IS THE PAGE'S. The modal owns the button and the repository state;
          the request, the watcher and the banner belong to the operation — which is what
          makes a pull survive this dialog being closed, and a reload.
        */
        pulling={githubPulling}
        onPull={() => void handleGithubPull()}
        blockedReason={githubPulling ? null : operationBusyReason}
      />
      {/* ⭐ Duplicate — the dashboard's dialog; on success it navigates to the copy itself. */}
      <CloneProjectDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        projectId={projectId}
        takenNames={takenNames}
        onCloned={() => {}}
      />
      <FigmaModal
        open={openModal === "figma"}
        onOpenChange={open => setOpenModal(open ? "figma" : null)}
        projectId={projectId}
        onStatusChange={setFigmaConnected}
      />
      {/*
        ⭐ LOGS — development AND production. The panel is the platform's: two sources,
        server-side regex search over the production window, auto-refresh. `flush` + a
        fixed height because the panel owns its own scroller.
      */}
      <Modal
        open={logsOpen}
        onOpenChange={setLogsOpen}
        size="xl"
        title={translate("workspace.logs.title")}
        description={translate("workspace.logs.modalDescription")}
        flush
      >
        <div className="h-[70vh]">
          <LogsPanel
            projectId={projectId}
            /* "you haven't published yet" vs "nothing was logged" are different answers. */
            hasBeenDeployed={project.deployment?.status === "success" || Boolean(project.productionProjectUrl)}
          />
        </div>
      </Modal>
      {/*
        ═══⭐⭐ THE IMPORT OVERLAY — the one operation that covers the screen ═══════
        A clone or import replaces EVERYTHING underneath: code, data, the running server.
        There is nothing to work with until it lands, so the platform covers the workspace
        with its first-build narrative rather than a banner. Copied unchanged; it renders
        whenever the slot says `import`, which the dashboard stamps before navigating here
        and the load effect adopts from the server's own lock after a reload.
      */}
      {operation.kind === "import" && (
        <ImportOverlay elapsedMs={operation.elapsedMs} projectId={projectId} />
      )}
    </div>
  );
}
