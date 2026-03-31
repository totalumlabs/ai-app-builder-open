"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, RotateCcw, Loader2, RefreshCw } from "lucide-react";
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
    const res = await api.get<{ versions: ProjectVersion[]; totalCount: number }>(
      `/api/vcaas/projects/${projectId}/versions?limit=50&skip=0`
    );
    if (res.ok && res.data) {
      setVersions(res.data.versions || []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleRecover = async (versionId: string) => {
    if (!confirm("Restore this version? Current changes will be overwritten.")) return;
    setRecovering(versionId);
    console.log("[Versions] Recovering version:", versionId);
    const res = await api.post(
      `/api/vcaas/projects/${projectId}/versions/${versionId}/recover`,
      {}
    );
    if (res.ok) {
      toast.success("Version recovery started. This may take a few minutes.");
      onVersionRestored();
    } else {
      toast.error(res.error || "Failed to start recovery");
    }
    setRecovering(null);
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <GitBranch className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">No versions yet</p>
        <p className="text-xs text-gray-400">
          Versions are created automatically when the AI agent builds your project.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b bg-gray-50/80 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">
          {versions.length} version{versions.length !== 1 ? "s" : ""}
        </span>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={fetchVersions}>
          <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {versions.map((version, idx) => (
          <Card key={version._id} className="p-4 border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <h4 className="font-medium text-sm">{version.name}</h4>
                  {idx === 0 && (
                    <Badge className="text-[10px] h-4 bg-emerald-100 text-emerald-700 border-0">
                      Latest
                    </Badge>
                  )}
                </div>
                {version.commitMessage && (
                  <p className="text-xs text-gray-600 mb-1 line-clamp-1">
                    {version.commitMessage}
                  </p>
                )}
                {version.prompt && (
                  <p className="text-xs text-gray-400 line-clamp-2">
                    {version.prompt}
                  </p>
                )}
                <span className="text-[10px] text-gray-400 mt-2 block">
                  {new Date(version.createdAt).toLocaleString()}
                </span>
              </div>
              {idx !== 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8 text-xs"
                  onClick={() => handleRecover(version._id)}
                  disabled={recovering === version._id}
                >
                  {recovering === version._id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Restore
                    </>
                  )}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
