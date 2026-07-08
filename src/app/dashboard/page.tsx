"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, Plus, Loader2, Trash2, Send, Paperclip, X, ArrowRight,
  Search, LayoutGrid, Table as TableIcon, ArrowUpDown, ChevronLeft, ChevronRight,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { LanguageSelect } from "@/components/LanguageSelect";
import type { VcaasProject } from "@/lib/vcaas-types";

// Shape returned by the VCaaS "List Projects" endpoint (GET /vcaas/projects).
// The platform is fully open — this lists every project in the account, no user
// account or database association is involved.
interface VcaasProjectSummary { projectId: string; description: string; plan: string; createdAt: string; }

type ViewMode = "cards" | "table";
type SortKey = "date-desc" | "date-asc" | "name-asc" | "name-desc";

const PAGE_SIZE = 20;
const VIEW_MODE_KEY = "vibebuild:dashboard-view";

// --- Deterministic gradient + initials for the placeholder thumbnail ---
const GRADIENTS: [string, string][] = [
  ["#6366f1", "#a855f7"], ["#0ea5e9", "#22d3ee"], ["#f43f5e", "#f97316"],
  ["#10b981", "#22d3ee"], ["#8b5cf6", "#ec4899"], ["#f59e0b", "#ef4444"],
  ["#3b82f6", "#8b5cf6"], ["#14b8a6", "#10b981"],
];
function gradientFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}
function initialsFor(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase() || "AP";
}

// Determine whether a project detail exposes a usable live preview URL.
function detailHasPreview(d: VcaasProject | null | undefined): boolean {
  if (!d) return false;
  const field = d.developmentUrlFieldToUse || "";
  const fieldUrl = field ? (d as unknown as Record<string, unknown>)[field] : null;
  return !!(fieldUrl || d.temporalDevelopmentProjectUrl || d.cachedDevelopmentUrl || d.productionProjectUrl);
}

/**
 * ProjectThumbnail — lazy, performance-friendly preview.
 *
 * To keep the dashboard fast even with many projects, the live iframe (and the
 * detail request that decides whether a preview exists) only runs once the card
 * scrolls into view (IntersectionObserver). Until then — and when a project has
 * no live URL — we render a lightweight gradient placeholder instead of an
 * iframe. The preview always points at the stable `projectId.totalum-project.com`
 * domain rather than the temporal development link.
 */
function ProjectThumbnail({
  projectId, getDetail, variant = "card",
}: {
  projectId: string;
  getDetail: (id: string) => Promise<VcaasProject | null>;
  variant?: "card" | "row";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: "250px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getDetail(projectId).then((d) => {
      if (cancelled) return;
      setStatus(detailHasPreview(d) ? "ready" : "none");
    });
    return () => { cancelled = true; };
  }, [visible, projectId, getDetail]);

  const previewUrl = `https://${projectId}.totalum-project.com`;
  const [c1, c2] = gradientFor(projectId);
  const isRow = variant === "row";

  const placeholder = (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
      <span className={`font-bold text-white/95 tracking-tight ${isRow ? "text-sm" : "text-2xl"}`}>{initialsFor(projectId)}</span>
      <Sparkles className={`absolute text-white/20 ${isRow ? "w-4 h-4 -right-0.5 -bottom-0.5" : "w-10 h-10 -right-1 -bottom-1"}`} />
    </div>
  );

  return (
    <div ref={ref} className="w-full h-full relative overflow-hidden bg-gray-100 dark:bg-gray-800">
      {status === "ready" && visible ? (
        <>
          <iframe
            src={previewUrl}
            loading="lazy"
            className={isRow ? "w-[400%] h-[400%] border-0 pointer-events-none origin-top-left" : "w-[200%] h-[200%] border-0 pointer-events-none origin-top-left"}
            style={{ transform: isRow ? "scale(0.25)" : "scale(0.5)" }}
            title={projectId}
            sandbox="allow-scripts allow-same-origin"
            tabIndex={-1}
          />
          <div className="absolute inset-0" />
        </>
      ) : status === "loading" && visible ? (
        <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${c1}22, ${c2}22)` }}>
          <Loader2 className={`animate-spin text-gray-300 ${isRow ? "w-4 h-4" : "w-5 h-5"}`} />
        </div>
      ) : (
        placeholder
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<VcaasProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  // First-prompt "Build" flow
  const [firstPrompt, setFirstPrompt] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; url: string; imageDescription: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  // Name modal (opened after clicking Build)
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [buildName, setBuildName] = useState("");
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildCreating, setBuildCreating] = useState(false);

  // List controls
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [page, setPage] = useState(1);

  // Lazy per-project detail cache (used only by visible thumbnails).
  const detailCache = useRef<Map<string, VcaasProject | null>>(new Map());
  const inflight = useRef<Map<string, Promise<VcaasProject | null>>>(new Map());
  const getDetail = useCallback(async (id: string): Promise<VcaasProject | null> => {
    if (detailCache.current.has(id)) return detailCache.current.get(id)!;
    if (inflight.current.has(id)) return inflight.current.get(id)!;
    const p = api.get<VcaasProject>(`/api/vcaas/projects/${id}`).then((r) => {
      const d = r.ok && r.data ? r.data : null;
      detailCache.current.set(id, d);
      inflight.current.delete(id);
      return d;
    });
    inflight.current.set(id, p);
    return p;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await api.get<VcaasProjectSummary[]>("/api/vcaas/projects");
    if (res.ok && res.data) {
      const list = Array.isArray(res.data) ? res.data : [];
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setProjects(list);
    } else {
      console.error("[Dashboard] Failed to list projects:", res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load persisted view mode once on mount.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(VIEW_MODE_KEY) : null;
    if (stored === "cards" || stored === "table") setViewMode(stored);
  }, []);

  // If the user hasn't chosen a view yet, default to table when there are many
  // projects (>20), otherwise cards.
  useEffect(() => {
    if (loading || viewMode !== null) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(VIEW_MODE_KEY) : null;
    if (stored === "cards" || stored === "table") { setViewMode(stored); return; }
    setViewMode(projects.length > 20 ? "table" : "cards");
  }, [loading, viewMode, projects.length]);

  const chooseView = (mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* ignore */ }
  };

  // Reset to first page whenever filters/sort change.
  useEffect(() => { setPage(1); }, [search, sortKey, viewMode]);

  // --- Derived: filtered → sorted → paginated ---
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = projects;
    if (q) list = projects.filter((p) =>
      p.projectId.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
    );
    const sorted = [...list].sort((a, b) => {
      switch (sortKey) {
        case "date-asc": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name-asc": return a.projectId.localeCompare(b.projectId);
        case "name-desc": return b.projectId.localeCompare(a.projectId);
        case "date-desc":
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return sorted;
  }, [projects, search, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  const resolvedView: ViewMode = viewMode ?? (projects.length > 20 ? "table" : "cards");

  // --- Create helpers ---
  const normalizeId = (raw: string) =>
    raw.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").replace(/^[^a-z]/, "a").slice(0, 35);

  const suggestName = (prompt: string) => {
    const words = prompt.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 4).join("-");
    const base = words.length >= 3 ? words : `app-${words}`;
    return normalizeId(base) || "my-app";
  };

  const handleManualCreate = async () => {
    const id = normalizeId(newProjectId);
    if (!id) return;
    setCreating(true);
    const res = await api.post("/api/vcaas/projects", { projectId: id, description: newProjectDesc.trim() });
    if (res.ok) {
      toast.success("Project created!"); setDialogOpen(false); setNewProjectId(""); setNewProjectDesc("");
      router.push(`/project/${id}`);
    } else toast.error(res.error || "Failed to create project");
    setCreating(false);
  };

  // Step 1 of the Build flow: open the name modal so the user picks a project name.
  const openBuildModal = () => {
    if (!firstPrompt.trim() && attachedFiles.length === 0) return;
    setBuildName(suggestName(firstPrompt));
    setBuildError(null);
    setNameModalOpen(true);
  };

  // Step 2: create the project with the chosen name, then carry the prompt over
  // to the workspace where it is auto-submitted to the chat.
  const confirmBuild = async () => {
    const id = normalizeId(buildName);
    if (id.length < 3) { setBuildError("Project name must be at least 3 characters (lowercase, hyphens allowed)."); return; }
    setBuildCreating(true);
    setBuildError(null);
    const res = await api.post("/api/vcaas/projects", { projectId: id, description: firstPrompt.trim().slice(0, 200) });
    if (!res.ok) {
      console.error("[Dashboard] Create failed:", res.error);
      setBuildError(`Could not create "${id}". This name is probably already taken — please choose a different project name.`);
      setBuildCreating(false);
      return;
    }
    // Stash the first prompt (and files) so the workspace auto-submits it.
    try {
      sessionStorage.setItem(`vibebuild:pendingPrompt:${id}`, firstPrompt.trim());
      if (attachedFiles.length > 0) sessionStorage.setItem(`vibebuild:pendingFiles:${id}`, JSON.stringify(attachedFiles));
    } catch (e) { console.error("[Dashboard] Failed to stash pending prompt:", e); }
    router.push(`/project/${id}`);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const tempUrl = URL.createObjectURL(file);
    setAttachedFiles((prev) => [...prev, { name: file.name, url: tempUrl, imageDescription: file.name }]);
    setUploading(false); e.target.value = "";
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Delete "${projectId}"?`)) return;
    detailCache.current.delete(projectId);
    const res = await api.delete(`/api/vcaas/projects/${projectId}`);
    if (res.ok) { toast.success("Project deleted"); setProjects((prev) => prev.filter((p) => p.projectId !== projectId)); }
    else toast.error(res.error || "Failed to delete project");
  };

  const hasProjects = projects.length > 0;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10" style={{ background: "#fcfbf8" }} />

      {/* Header */}
      <header className="sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold tracking-tight text-gray-900 text-sm">VibeBuild</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelect />
            <Link href="/">
              <button className="text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-black/5 transition-colors">Home</button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero prompt */}
        {!loading && (
          <div className={hasProjects ? "mb-10" : "flex flex-col items-center justify-center min-h-[50vh]"}>
            <div className="w-full max-w-2xl mx-auto">
              <div className="text-center mb-6">
                {!hasProjects && (
                  <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                )}
                <h1 className={`font-bold tracking-tight text-gray-900 ${hasProjects ? "text-xl" : "text-3xl sm:text-4xl"}`}>
                  What do you want to build?
                </h1>
                {!hasProjects && <p className="text-gray-500 max-w-md mx-auto mt-2 text-sm">Describe your app and AI will build it in minutes.</p>}
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-200/60 overflow-hidden">
                <textarea
                  value={firstPrompt}
                  onChange={(e) => setFirstPrompt(e.target.value)}
                  placeholder="Describe your app... e.g. 'A project management tool with kanban boards'"
                  className="w-full min-h-[90px] sm:min-h-[110px] resize-none text-[15px] p-5 pb-2 outline-none placeholder:text-gray-400 bg-transparent"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); openBuildModal(); } }}
                />
                {attachedFiles.length > 0 && (
                  <div className="px-5 pb-2 flex gap-1.5 flex-wrap">
                    {attachedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1 bg-gray-100 text-gray-600 rounded-md px-2 py-0.5 text-[11px]">
                        <Paperclip className="w-2.5 h-2.5" /><span className="truncate max-w-[100px]">{f.name}</span>
                        <button onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}><X className="w-2.5 h-2.5 hover:text-red-500" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100/80">
                  <label className="cursor-pointer flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors px-1.5 py-1 rounded-lg hover:bg-gray-50">
                    <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.svg" />
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    <span className="hidden sm:inline">Attach</span>
                  </label>
                  <button onClick={openBuildModal} disabled={!firstPrompt.trim() && attachedFiles.length === 0}
                    className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white text-xs font-medium px-4 h-8 rounded-xl transition-colors">
                    <Send className="w-3.5 h-3.5" /><span>Build</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projects */}
        {hasProjects && (
          <>
            {/* Toolbar: search, sort, view toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-700">Projects</h2>
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{filtered.length}</span>
              </div>

              <div className="flex-1 flex flex-wrap items-center gap-2 sm:justify-end">
                {/* Search */}
                <div className="relative flex-1 sm:flex-none sm:w-56 min-w-[160px]">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by id or description..."
                    className="w-full h-8 pl-8 pr-7 text-xs rounded-lg border border-gray-200 bg-white/70 text-gray-700 outline-none focus:ring-2 focus:ring-gray-200"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Sort */}
                <div className="relative">
                  <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="h-8 pl-8 pr-6 text-xs rounded-lg border border-gray-200 bg-white/70 text-gray-700 outline-none focus:ring-2 focus:ring-gray-200 appearance-none cursor-pointer"
                  >
                    <option value="date-desc">Newest first</option>
                    <option value="date-asc">Oldest first</option>
                    <option value="name-asc">Name A–Z</option>
                    <option value="name-desc">Name Z–A</option>
                  </select>
                </div>

                {/* View toggle */}
                <div className="flex items-center rounded-lg border border-gray-200 bg-white/70 p-0.5">
                  <button
                    onClick={() => chooseView("cards")}
                    title="Card view"
                    className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${resolvedView === "cards" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => chooseView("table")}
                    title="Table view"
                    className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${resolvedView === "table" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Manual create */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 h-8 px-2.5 rounded-lg border border-gray-200 bg-white/70 hover:bg-white transition-colors">
                      <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label>Project ID</Label>
                        <Input placeholder="my-app" value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)} className="mt-1.5" />
                        <p className="text-xs text-gray-400 mt-1">4-35 chars, lowercase, hyphens ok</p>
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input placeholder="Brief description" value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} className="mt-1.5" />
                      </div>
                      <Button className="w-full bg-gray-900 hover:bg-gray-800" onClick={handleManualCreate} disabled={creating || !newProjectId.trim()}>
                        {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Create
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No projects match &ldquo;{search}&rdquo;</p>
              </div>
            ) : resolvedView === "cards" ? (
              /* ── CARD VIEW ── */
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pageItems.map((p) => (
                  <Link key={p.projectId} href={`/project/${p.projectId}`}>
                    <div className="bg-white/70 backdrop-blur-sm border border-gray-200/50 rounded-xl overflow-hidden hover:shadow-lg hover:bg-white/90 transition-all cursor-pointer group h-full">
                      <div className="h-32 relative overflow-hidden">
                        <ProjectThumbnail projectId={p.projectId} getDetail={getDetail} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-medium text-sm text-gray-800 group-hover:text-gray-900 truncate flex-1">{p.projectId}</h3>
                          <button className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-gray-50 transition-all shrink-0 ml-2" onClick={(e) => handleDeleteProject(p.projectId, e)}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-1">{p.description || "No description"}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                          <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              /* ── TABLE VIEW ── */
              <div className="bg-white/70 backdrop-blur-sm border border-gray-200/60 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-200/70 text-[11px] uppercase tracking-wider text-gray-400">
                        <th className="font-medium px-4 py-2.5 w-16">Preview</th>
                        <th className="font-medium px-2 py-2.5">Project</th>
                        <th className="font-medium px-2 py-2.5 hidden md:table-cell">Description</th>
                        <th className="font-medium px-2 py-2.5 whitespace-nowrap">Created</th>
                        <th className="font-medium px-4 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((p) => (
                        <tr
                          key={p.projectId}
                          onClick={() => router.push(`/project/${p.projectId}`)}
                          className="border-b border-gray-100/70 last:border-0 hover:bg-gray-50/60 cursor-pointer transition-colors group"
                        >
                          <td className="px-4 py-2">
                            <div className="w-11 h-8 rounded-md overflow-hidden border border-gray-200/60">
                              <ProjectThumbnail projectId={p.projectId} getDetail={getDetail} variant="row" />
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">{p.projectId}</span>
                          </td>
                          <td className="px-2 py-2 hidden md:table-cell">
                            <span className="text-xs text-gray-500 line-clamp-1 max-w-[280px]">{p.description || "No description"}</span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              className="w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-gray-100 transition-all"
                              onClick={(e) => handleDeleteProject(p.projectId, e)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white/70 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500 px-2">Page {safePage} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white/70 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl bg-white/40" />)}
          </div>
        )}
      </div>

      {/* Name modal for the Build flow */}
      <Dialog open={nameModalOpen} onOpenChange={(o) => { if (!buildCreating) setNameModalOpen(o); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Name your project</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-gray-500">Choose a unique name for your project. It will be used in the URL.</p>
            <div>
              <Label>Project name</Label>
              <Input
                autoFocus
                placeholder="my-awesome-app"
                value={buildName}
                onChange={(e) => { setBuildName(e.target.value); if (buildError) setBuildError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !buildCreating) confirmBuild(); }}
                className="mt-1.5"
              />
              <p className="text-xs text-gray-400 mt-1">3-35 chars, lowercase, hyphens allowed. Final id: <span className="font-mono text-gray-500">{normalizeId(buildName) || "…"}</span></p>
            </div>
            {buildError && (
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{buildError}</span>
              </div>
            )}
            <Button className="w-full bg-gray-900 hover:bg-gray-800" onClick={confirmBuild} disabled={buildCreating || normalizeId(buildName).length < 3}>
              {buildCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <><ArrowRight className="w-4 h-4 mr-2" /> Create & Build</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
