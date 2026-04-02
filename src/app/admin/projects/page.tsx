"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { timeAgo } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Loader2, ChevronLeft, ChevronRight,
  FolderOpen, ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface AdminProject {
  _id: string;
  project_id: string;
  owner_id: string;
  description: string;
  createdAt: string;
  ownerUser: { _id: string; name: string; email: string; role: string } | null;
  vcaas: {
    projectId: string;
    agentProcessStatus?: string;
    agentServerStatus?: string;
    deployment?: { status: string } | null;
    totalCreditsSpent?: number;
    createdAt?: string;
  } | null;
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
}

function agentBadge(status?: string) {
  if (!status) return <StatusBadge label="—" color="bg-gray-100 text-gray-400" />;
  if (status === "init") return <StatusBadge label="building" color="bg-amber-50 text-amber-600 animate-pulse" />;
  if (status === "done") return <StatusBadge label="done" color="bg-green-50 text-green-600" />;
  return <StatusBadge label={status} color="bg-gray-100 text-gray-500" />;
}

function serverBadge(status?: string) {
  if (!status) return <StatusBadge label="—" color="bg-gray-100 text-gray-400" />;
  if (status === "Active") return <StatusBadge label="Active" color="bg-green-50 text-green-600" />;
  if (status === "Archived") return <StatusBadge label="Archived" color="bg-gray-100 text-gray-500" />;
  return <StatusBadge label={status} color="bg-amber-50 text-amber-600" />;
}

function deployBadge(status?: string | null) {
  if (!status) return <StatusBadge label="none" color="bg-gray-100 text-gray-400" />;
  if (status === "success") return <StatusBadge label="success" color="bg-green-50 text-green-600" />;
  if (status === "deploying") return <StatusBadge label="deploying" color="bg-amber-50 text-amber-600" />;
  if (status === "error") return <StatusBadge label="error" color="bg-red-50 text-red-600" />;
  return <StatusBadge label={status} color="bg-gray-100 text-gray-500" />;
}

export default function AdminProjectsPage() {
  const { isPending } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [initialCheck, setInitialCheck] = useState(true);
  const limit = 20;

  // Check admin access
  useEffect(() => {
    async function checkAccess() {
      const res = await api.get("/api/admin/stats");
      if (!res.ok) {
        setAccessDenied(true);
        router.push("/dashboard");
        return;
      }
      setInitialCheck(false);
    }
    if (!isPending) checkAccess();
  }, [isPending, router]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set("search", search);
    const res = await api.get<AdminProject[]>(`/api/admin/projects?${params}`);
    if (res.ok && res.data) {
      setProjects(res.data);
      setTotal(res.total || res.data.length);
    }
    setLoading(false);
  }, [search, offset]);

  useEffect(() => {
    if (!initialCheck && !accessDenied) fetchProjects();
  }, [initialCheck, accessDenied, fetchProjects]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setOffset(0);
  };

  if (isPending || (initialCheck && !accessDenied)) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#fcfbf8" }}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (accessDenied) return null;

  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;

  return (
    <div className="min-h-screen" style={{ background: "#fcfbf8" }}>
      <AdminHeader activeTab="projects" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={t("searchProjects")}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 bg-white/80 border-gray-200/60"
            />
          </div>
          {total > 0 && (
            <p className="text-xs text-gray-400 hidden sm:block">
              {from}-{to} of {total}
            </p>
          )}
        </div>

        {/* Projects Table (desktop) */}
        <div className="hidden sm:block bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Project ID</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">{t("owner")}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">{t("status")}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">{t("serverStatus")}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">{t("deploymentStatus")}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">{t("creditsSpent")}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden xl:table-cell">{t("created")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28 bg-gray-100" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24 bg-gray-100" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded bg-gray-100" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-14 rounded bg-gray-100" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded bg-gray-100" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12 bg-gray-100" /></td>
                    <td className="px-4 py-3 hidden xl:table-cell"><Skeleton className="h-4 w-20 bg-gray-100" /></td>
                  </tr>
                ))
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">{t("noProjects")}</p>
                  </td>
                </tr>
              ) : (
                projects.map((proj) => (
                  <tr key={proj._id} className="border-b border-gray-50 hover:bg-black/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/project/${proj.project_id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1">
                        {proj.project_id}
                        <ExternalLink className="w-3 h-3 text-gray-300" />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {proj.ownerUser ? (
                        <Link href={`/admin/users/${proj.ownerUser._id}`} className="group">
                          <p className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors truncate max-w-[140px]">{proj.ownerUser.name || "—"}</p>
                          <p className="text-[11px] text-gray-400 truncate max-w-[140px]">{proj.ownerUser.email}</p>
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{agentBadge(proj.vcaas?.agentProcessStatus)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{serverBadge(proj.vcaas?.agentServerStatus)}</td>
                    <td className="px-4 py-3">{deployBadge(proj.vcaas?.deployment?.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{(proj.vcaas?.totalCreditsSpent ?? 0).toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden xl:table-cell">{proj.createdAt ? new Date(proj.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Projects Cards (mobile) */}
        <div className="sm:hidden space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl bg-white/40" />)
          ) : projects.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-8 text-center">
              <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{t("noProjects")}</p>
            </div>
          ) : (
            projects.map((proj) => (
              <div key={proj._id} className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-4 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/project/${proj.project_id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1">
                    {proj.project_id}
                    <ExternalLink className="w-3 h-3 text-gray-300" />
                  </Link>
                  <span className="text-[11px] text-gray-400">{(proj.vcaas?.totalCreditsSpent ?? 0).toFixed(1)} credits</span>
                </div>
                {proj.ownerUser && (
                  <Link href={`/admin/users/${proj.ownerUser._id}`} className="text-xs text-gray-500 hover:text-blue-600 transition-colors mb-2 block">
                    {proj.ownerUser.name || proj.ownerUser.email}
                  </Link>
                )}
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  {agentBadge(proj.vcaas?.agentProcessStatus)}
                  {deployBadge(proj.vcaas?.deployment?.status)}
                  {serverBadge(proj.vcaas?.agentServerStatus)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-400">{from}-{to} of {total}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => setOffset(Math.max(0, offset - limit))} className="h-8 text-xs">
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setOffset(offset + limit)} className="h-8 text-xs">
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
