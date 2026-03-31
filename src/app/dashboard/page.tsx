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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Plus,
  CreditCard,
  LogOut,
  Loader2,
  Trash2,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface ProjectSummary {
  projectId: string;
  description: string;
  plan: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [projectsRes, accountRes] = await Promise.all([
      api.get<ProjectSummary[]>("/api/vcaas/projects"),
      api.get<{ credits: number }>("/api/vcaas/account"),
    ]);
    if (projectsRes.ok && projectsRes.data) {
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
    }
    if (accountRes.ok && accountRes.data) {
      setCredits(accountRes.data.credits);
    }
    setLoading(false);
    console.log("[Dashboard] Loaded projects:", projectsRes.data, "Credits:", accountRes.data);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateProject = async () => {
    const id = newProjectId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id) return;
    setCreating(true);
    console.log("[Dashboard] Creating project:", id);
    const res = await api.post("/api/vcaas/projects", {
      projectId: id,
      description: newProjectDesc.trim(),
    });
    if (res.ok) {
      toast.success("Project created!");
      setDialogOpen(false);
      setNewProjectId("");
      setNewProjectDesc("");
      router.push(`/project/${id}`);
    } else {
      toast.error(res.error || "Failed to create project");
      console.error("[Dashboard] Create project error:", res.error);
    }
    setCreating(false);
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete project "${projectId}"? This action cannot be undone.`)) return;
    console.log("[Dashboard] Deleting project:", projectId);
    const res = await api.delete(`/api/vcaas/projects/${projectId}`);
    if (res.ok) {
      toast.success("Project deleted");
      fetchData();
    } else {
      toast.error(res.error || "Failed to delete project");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">VibeBuild</span>
          </Link>
          <div className="flex items-center gap-4">
            {credits !== null && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
                <CreditCard className="w-3.5 h-3.5" />
                <span className="font-medium">{credits}</span>
                <span className="text-gray-400">credits</span>
              </div>
            )}
            <span className="text-sm text-gray-400 hidden md:block">
              {session?.user?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-gray-600"
              onClick={() =>
                signOut({
                  fetchOptions: { onSuccess: () => router.push("/") },
                })
              }
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Projects</h1>
            <p className="text-sm text-gray-400 mt-1">Build and manage your AI-generated apps</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="project-id">Project ID</Label>
                  <Input
                    id="project-id"
                    placeholder="my-awesome-app"
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    4-35 characters. Lowercase letters, numbers, and hyphens only. Must start with a letter.
                  </p>
                </div>
                <div>
                  <Label htmlFor="project-desc">Description (optional)</Label>
                  <Input
                    id="project-desc"
                    placeholder="A brief description of your project"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                  onClick={handleCreateProject}
                  disabled={creating || !newProjectId.trim()}
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create Project (1 credit)
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
              <FolderOpen className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No projects yet</h3>
            <p className="text-gray-400 mb-6 max-w-sm">
              Create your first project and let AI build something amazing for you.
            </p>
            <Button
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Project
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => (
              <Link key={project.projectId} href={`/project/${project.projectId}`}>
                <Card className="p-6 hover:shadow-lg hover:border-violet-200 transition-all duration-200 cursor-pointer group h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                        <Sparkles className="w-4 h-4 text-violet-600" />
                      </div>
                      <h3 className="font-semibold group-hover:text-violet-600 transition-colors">
                        {project.projectId}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                      onClick={(e) => handleDeleteProject(project.projectId, e)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[40px]">
                    {project.description || "No description"}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <Badge variant="secondary" className="text-xs">
                      {project.plan}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
