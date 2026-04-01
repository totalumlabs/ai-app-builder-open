"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Plus, LogOut, Loader2, Trash2, Send, Paperclip, X, ArrowRight, User, Shield } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { VcaasProject } from "@/lib/vcaas-types";

interface UserProjectRecord { _id: string; user_id: string; project_id: string; description: string; createdAt: string; }

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [userProjects, setUserProjects] = useState<UserProjectRecord[]>([]);
  const [projectDetails, setProjectDetails] = useState<Record<string, VcaasProject>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [firstPrompt, setFirstPrompt] = useState("");
  const [sendingFirst, setSendingFirst] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; url: string; imageDescription: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await api.get<UserProjectRecord[]>("/api/user-projects");
    if (res.ok && res.data) {
      const projects = Array.isArray(res.data) ? res.data : [];
      setUserProjects(projects);
      // Fetch project details for thumbnails
      const details: Record<string, VcaasProject> = {};
      await Promise.all(projects.slice(0, 12).map(async (p) => {
        const r = await api.get<VcaasProject>(`/api/vcaas/projects/${p.project_id}`);
        if (r.ok && r.data) details[p.project_id] = r.data;
      }));
      setProjectDetails(details);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Check admin role (lightweight — just hit stats endpoint)
  useEffect(() => {
    api.get("/api/admin/stats").then((res) => { if (res.ok) setIsAdmin(true); });
  }, []);

  const handleCreateProject = async () => {
    const id = newProjectId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id) return;
    setCreating(true);
    const res = await api.post("/api/vcaas/projects", { projectId: id, description: newProjectDesc.trim() });
    if (res.ok) {
      await api.post("/api/user-projects", { project_id: id, description: newProjectDesc.trim() });
      toast.success("Project created!"); setDialogOpen(false); setNewProjectId(""); setNewProjectDesc("");
      router.push(`/project/${id}`);
    } else toast.error(res.error || "Failed to create project");
    setCreating(false);
  };

  const handleFirstPrompt = async () => {
    if ((!firstPrompt.trim() && attachedFiles.length === 0) || sendingFirst) return;
    setSendingFirst(true);
    const words = firstPrompt.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/).slice(0, 4).join("-");
    const projectId = words.length >= 4 ? words.slice(0, 35) : `app-${words}`.slice(0, 35);
    const safeId = projectId.replace(/^[^a-z]+/, "a-");
    const createRes = await api.post("/api/vcaas/projects", { projectId: safeId, description: firstPrompt.trim().slice(0, 200) });
    if (!createRes.ok) { toast.error(createRes.error || "Failed to create project"); setSendingFirst(false); return; }
    await api.post("/api/user-projects", { project_id: safeId, description: firstPrompt.trim().slice(0, 200) });
    await api.post(`/api/vcaas/projects/${safeId}/agent/start`, { prompt: firstPrompt.trim(), inputFiles: attachedFiles });
    router.push(`/project/${safeId}`);
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
    await api.delete(`/api/vcaas/projects/${projectId}`);
    await api.delete(`/api/user-projects/${projectId}`);
    toast.success("Project deleted"); fetchData();
  };

  const getPreviewUrl = (pid: string) => {
    const d = projectDetails[pid];
    if (!d) return null;
    const field = d.developmentUrlFieldToUse || "temporalDevelopmentProjectUrl";
    return (d as unknown as Record<string, unknown>)[field] as string || d.temporalDevelopmentProjectUrl || d.cachedDevelopmentUrl || null;
  };

  const hasProjects = userProjects.length > 0;
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background matching builder */}
      <div className="fixed inset-0 -z-10" style={{ background: "#fcfbf8" }} />

      {/* Header - matches builder: no bg, no border, transparent */}
      <header className="sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold tracking-tight text-gray-900 text-sm">VibeBuild</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin">
                <button className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Admin Panel">
                  <Shield className="w-4 h-4" />
                </button>
              </Link>
            )}
            <Link href="/profile">
              <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-colors">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600">{userInitial}</div>
                <span className="text-xs hidden sm:block">{userName}</span>
              </button>
            </Link>
            <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
              onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push("/") } })}>
              <LogOut className="w-4 h-4" />
            </button>
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
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleFirstPrompt(); } }}
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
                  <button onClick={handleFirstPrompt} disabled={(!firstPrompt.trim() && attachedFiles.length === 0) || sendingFirst}
                    className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white text-xs font-medium px-4 h-8 rounded-xl transition-colors">
                    {sendingFirst ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5" /><span>Build</span></>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projects */}
        {hasProjects && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-700">Your Projects</h2>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-white/60 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Manual Create
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
                    <Button className="w-full bg-gray-900 hover:bg-gray-800" onClick={handleCreateProject} disabled={creating || !newProjectId.trim()}>
                      {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Create
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userProjects.map((up) => {
                const thumbUrl = getPreviewUrl(up.project_id);
                return (
                  <Link key={up._id} href={`/project/${up.project_id}`}>
                    <div className="bg-white/70 backdrop-blur-sm border border-gray-200/50 rounded-xl overflow-hidden hover:shadow-lg hover:bg-white/90 transition-all cursor-pointer group h-full">
                      {/* Project thumbnail */}
                      <div className="h-32 bg-gray-100 relative overflow-hidden">
                        {thumbUrl ? (
                          <iframe
                            src={thumbUrl}
                            className="w-[200%] h-[200%] border-0 pointer-events-none origin-top-left"
                            style={{ transform: "scale(0.5)" }}
                            title={up.project_id}
                            sandbox="allow-scripts allow-same-origin"
                            tabIndex={-1}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-gray-200" />
                          </div>
                        )}
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                      </div>
                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-medium text-sm text-gray-800 group-hover:text-gray-900 truncate flex-1">{up.project_id}</h3>
                          <button className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-gray-50 transition-all shrink-0 ml-2" onClick={(e) => handleDeleteProject(up.project_id, e)}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-1">{up.description || "No description"}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-gray-400">{new Date(up.createdAt).toLocaleDateString()}</span>
                          <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl bg-white/40" />)}
          </div>
        )}
      </div>
    </div>
  );
}
