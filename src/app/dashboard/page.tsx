"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  FolderOpen,
  Send,
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
    // Create VCaaS project
    const res = await api.post("/api/vcaas/projects", {
      projectId: id,
      description: newProjectDesc.trim(),
    });
    if (res.ok) {
      // Store association
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
    if (!firstPrompt.trim() || sendingFirst) return;
    setSendingFirst(true);
    // Auto-generate project ID from first few words
    const words = firstPrompt.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/).slice(0, 4).join("-");
    const projectId = words.length >= 4 ? words.slice(0, 35) : `app-${words}`.slice(0, 35);
    const safeId = projectId.replace(/^[^a-z]+/, "a-");

    // Create VCaaS project
    const createRes = await api.post("/api/vcaas/projects", {
      projectId: safeId,
      description: firstPrompt.trim().slice(0, 200),
    });
    if (!createRes.ok) {
      toast.error(createRes.error || "Failed to create project");
      setSendingFirst(false);
      return;
    }

    // Store user-project association
    await api.post("/api/user-projects", {
      project_id: safeId,
      description: firstPrompt.trim().slice(0, 200),
    });

    // Start agent with the prompt
    await api.post(`/api/vcaas/projects/${safeId}/agent/start`, {
      prompt: firstPrompt.trim(),
      inputFiles: [],
    });

    // Redirect to workspace
    router.push(`/project/${safeId}`);
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete project "${projectId}"? This cannot be undone.`)) return;
    // Delete from VCaaS
    await api.delete(`/api/vcaas/projects/${projectId}`);
    // Delete local association
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
        {/* First prompt hero - shown when no projects or always at top */}
        {!loading && (
          <div className={`${hasProjects ? "mb-10" : "flex flex-col items-center justify-center min-h-[60vh]"}`}>
            <div className={`w-full ${hasProjects ? "max-w-2xl" : "max-w-2xl"}`}>
              {!hasProjects && (
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-5">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">What do you want to build?</h1>
                  <p className="text-gray-500 max-w-md mx-auto">Describe your app idea and our AI will build it for you in minutes.</p>
                </div>
              )}
              <div className="relative">
                <Textarea
                  value={firstPrompt}
                  onChange={(e) => setFirstPrompt(e.target.value)}
                  placeholder={hasProjects ? "Start a new project... describe what you want to build" : "Describe your app... e.g. 'A task management app with drag-and-drop boards'"}
                  className="min-h-[100px] sm:min-h-[120px] resize-none rounded-2xl border-2 border-gray-200 focus:border-violet-400 bg-white shadow-sm text-base pr-14 p-4 sm:p-5"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleFirstPrompt();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="absolute bottom-3 right-3 w-10 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg"
                  onClick={handleFirstPrompt}
                  disabled={!firstPrompt.trim() || sendingFirst}
                >
                  {sendingFirst ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Projects list */}
        {hasProjects && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Your Projects</h2>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1.5" /> New Project
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        )}

        {!loading && !hasProjects && (
          <div className="text-center mt-4">
            <p className="text-xs text-gray-400">Or create a project manually</p>
            <Button variant="link" size="sm" className="text-violet-600" onClick={() => setDialogOpen(true)}>
              <Plus className="w-3 h-3 mr-1" /> Advanced Create
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
