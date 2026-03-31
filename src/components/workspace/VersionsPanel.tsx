"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, RotateCcw, Loader2, RefreshCw, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { ProjectVersion } from "@/lib/vcaas-types";

interface VersionsPanelProps {
  projectId: string;
  onVersionRestored: () => void;
}

export function VersionsPanel({ projectId, onVersionRestored }: VersionsPanelProps) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ versions: ProjectVersion[]; totalCount: number }>(`/api/vcaas/projects/${projectId}/versions?limit=50&skip=0`);
    if (res.ok && res.data) setVersions(res.data.versions || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const handleRecover = async (versionId: string) => {
    if (!confirm("Restore this version? Current changes will be overwritten.")) return;
    setRecovering(versionId);
    const res = await api.post(`/api/vcaas/projects/${projectId}/versions/${versionId}/recover`, {});
    if (res.ok) { toast.success("Version recovery started..."); onVersionRestored(); }
    else toast.error(res.error || "Failed to start recovery");
    setRecovering(null);
  };

  if (loading) {
    return <div className="p-5 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
          <GitBranch className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">No versions yet</p>
        <p className="text-xs text-gray-400 max-w-xs">Versions are created automatically each time the AI agent builds your project.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-medium">{versions.length} version{versions.length !== 1 ? "s" : ""}</span>
        </div>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={fetchVersions}><RefreshCw className="w-3.5 h-3.5 text-gray-500" /></Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-0">
            {versions.map((version, idx) => (
              <div key={version._id} className="relative pl-10 pb-6 last:pb-0">
                {/* Dot */}
                <div className={`absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 ${idx === 0 ? "bg-violet-500 border-violet-500" : "bg-white border-gray-300"}`} />

                <div className={`bg-white rounded-xl border p-4 transition-all hover:shadow-sm ${idx === 0 ? "border-violet-200 shadow-sm" : "border-gray-100"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{version.name}</h4>
                        {idx === 0 && <Badge className="text-[9px] h-4 bg-violet-100 text-violet-700 border-0">Current</Badge>}
                      </div>
                      {version.commitMessage && (
                        <p className="text-xs text-gray-600 mb-1.5 line-clamp-1">{version.commitMessage}</p>
                      )}
                      {version.prompt && (
                        <div className="flex items-start gap-1.5 mt-1.5">
                          <MessageSquare className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-gray-400 line-clamp-2 italic">{version.prompt}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400">
                        <Clock className="w-3 h-3" />
                        {new Date(version.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {idx !== 0 && (
                      <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs rounded-lg" onClick={() => handleRecover(version._id)} disabled={recovering === version._id}>
                        {recovering === version._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RotateCcw className="w-3 h-3 mr-1" /> Restore</>}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
