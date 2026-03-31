"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Plus,
  LogOut,
  Loader2,
  Trash2,
  Send,
  Paperclip,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface UserProjectRecord {
  _id: string;
  user_id: string;
  project_id: string;
  description: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [userProjects, setUserProjects] = useState<UserProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  // First prompt flow
  const [firstPrompt, setFirstPrompt] = useState("");
  const [sendingFirst, setSendingFirst] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; url: string; imageDescription: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await api.get<UserProjectRecord[]>("/api/user-projects");
    if (res.ok && res.data) {
      setUserProjects(Array.isArray(res.data) ? res.data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateProject = async () => {
    const id = newProjectId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id) return;
    setCreating(true);
    const res = await api.post("/api/vcaas/projects", {
      projectId: id,
      description: newProjectDesc.trim(),
    });
    if (res.ok) {
      await api.post("/api/user-projects", {
        project_id: id,
        description: newProjectDesc.trim(),
      });
      toast.success("Project created!");
      setDialogOpen(false);
      setNewProjectId("");
      setNewProjectDesc("");
      router.push(`/project/${id}`);
    } else {
      toast.error(res.error || "Failed to create project");
    }
    setCreating(false);
  };

  const handleFirstPrompt = async () => {
    if ((!firstPrompt.trim() && attachedFiles.length === 0) || sendingFirst) return;
    setSendingFirst(true);
    const words = firstPrompt.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/).slice(0, 4).join("-");
    const projectId = words.length >= 4 ? words.slice(0, 35) : `app-${words}`.slice(0, 35);
    const safeId = projectId.replace(/^[^a-z]+/, "a-");

    const createRes = await api.post("/api/vcaas/projects", {
      projectId: safeId,
      description: firstPrompt.trim().slice(0, 200),
    });
    if (!createRes.ok) {
      toast.error(createRes.error || "Failed to create project");
      setSendingFirst(false);
      return;
    }

    await api.post("/api/user-projects", {
      project_id: safeId,
      description: firstPrompt.trim().slice(0, 200),
    });

    await api.post(`/api/vcaas/projects/${safeId}/agent/start`, {
      prompt: firstPrompt.trim(),
      inputFiles: attachedFiles,
    });

    router.push(`/project/${safeId}`);
  };

  // We can't upload files without a project yet, so we use a temporary approach:
  // upload to a generic endpoint after project creation, or just store locally
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    // For the initial prompt, we'll just store files locally and pass them after project creation
    // Create a temporary object URL for preview
    const tempUrl = URL.createObjectURL(file);
    setAttachedFiles((prev) => [...prev, {
      name: file.name,
      url: tempUrl,
      imageDescription: file.name,
    }]);
    // Store the actual file for later upload
    setUploading(false);
    e.target.value = "";
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete project "${projectId}"? This cannot be undone.`)) return;
    await api.delete(`/api/vcaas/projects/${projectId}`);
    await api.delete(`/api/user-projects/${projectId}`);
    toast.success("Project deleted");
    fetchData();
  };

  const hasProjects = userProjects.length > 0;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold tracking-tight hidden sm:block">VibeBuild</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 hidden md:block">{session?.user?.email}</span>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-gray-400 hover:text-gray-600"
              onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push("/") } })}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero section - always shown */}
        {!loading && (
          <div className={hasProjects ? "mb-10" : "flex flex-col items-center justify-center min-h-[50vh]"}>
            <div className="w-full max-w-2xl mx-auto">
              <div className="text-center mb-6">
                {!hasProjects && (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                )}
                <h1 className={`font-bold tracking-tight mb-2 ${hasProjects ? "text-xl" : "text-3xl sm:text-4xl"}`}>
                  What do you want to build?
                </h1>
                {!hasProjects && (
                  <p className="text-gray-500 max-w-md mx-auto text-sm">
                    Describe your app idea and our AI will build it for you in minutes.
                  </p>
                )}
              </div>

              {/* Prompt input area */}
              <div className="bg-white rounded-2xl border-2 border-gray-200 focus-within:border-violet-400 shadow-sm transition-all overflow-hidden">
                <textarea
                  value={firstPrompt}
                  onChange={(e) => setFirstPrompt(e.target.value)}
                  placeholder={hasProjects ? "Start a new project..." : "Describe your app... e.g. 'A task management app with boards'"}
                  className="w-full min-h-[80px] sm:min-h-[100px] resize-none text-base p-4 sm:p-5 pb-2 outline-none placeholder:text-gray-400 bg-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleFirstPrompt();
                    }
                  }}
                />

                {/* Attached files */}
                {attachedFiles.length > 0 && (
                  <div className="px-4 pb-2 flex gap-2 flex-wrap">
                    {attachedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-violet-50 text-violet-700 rounded-lg px-2.5 py-1 text-xs">
                        <Paperclip className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{f.name}</span>
                        <button onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}>
                          <X className="w-3 h-3 hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom toolbar */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
                  <label className="cursor-pointer flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-600 transition-colors">
                    <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.svg" />
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Attach file</span>
                  </label>
                  <Button
                    size="sm"
                    className="h-8 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-md"
                    onClick={handleFirstPrompt}
                    disabled={(!firstPrompt.trim() && attachedFiles.length === 0) || sendingFirst}
                  >
                    {sendingFirst ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1.5" />Build</>}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projects list - always shown when has projects */}
        {hasProjects && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-700">Your Projects</h2>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Manual Create
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create New Project</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="project-id">Project ID</Label>
                      <Input id="project-id" placeholder="my-awesome-app" value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)} className="mt-1.5" />
                      <p className="text-xs text-gray-400 mt-1">4-35 chars, lowercase, hyphens ok</p>
                    </div>
                    <div>
                      <Label htmlFor="project-desc">Description</Label>
                      <Input id="project-desc" placeholder="Brief description" value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} className="mt-1.5" />
                    </div>
                    <Button className="w-full bg-gradient-to-r from-violet-600 to-indigo-600" onClick={handleCreateProject} disabled={creating || !newProjectId.trim()}>
                      {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Create Project
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userProjects.map((up) => (
                <Link key={up._id} href={`/project/${up.project_id}`}>
                  <Card className="p-5 hover:shadow-lg hover:border-violet-200 transition-all cursor-pointer group h-full">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                          <Sparkles className="w-4 h-4 text-violet-600" />
                        </div>
                        <h3 className="font-semibold text-sm group-hover:text-violet-600 transition-colors">{up.project_id}</h3>
                      </div>
                      <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500" onClick={(e) => handleDeleteProject(up.project_id, e)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{up.description || "No description"}</p>
                    <span className="text-[10px] text-gray-400 mt-3 block">{new Date(up.createdAt).toLocaleDateString()}</span>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}

        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        )}
      </div>
    </div>
  );
}
