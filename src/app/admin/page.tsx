"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatCard } from "@/components/admin/StatCard";
import { UserRoleBadge } from "@/components/admin/UserRoleBadge";
import { timeAgo } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, FolderOpen, Zap, Activity, Search, Loader2,
  ChevronLeft, ChevronRight, UserCircle,
} from "lucide-react";
import Link from "next/link";

interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  totalCreditsSpent: number;
  activeProjects: number;
}

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  email_verified: number | boolean;
  createdAt: string;
  projectCount: number;
  lastActivity: string | null;
}

export default function AdminPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const limit = 20;

  // Check admin access
  useEffect(() => {
    async function checkAccess() {
      const res = await api.get<AdminStats>("/api/admin/stats");
      if (!res.ok) {
        console.log("[Admin] Access denied, redirecting to dashboard");
        setAccessDenied(true);
        router.push("/dashboard");
        return;
      }
      setStats(res.data || null);
      setLoadingStats(false);
    }
    if (!isPending) checkAccess();
  }, [isPending, router]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set("search", search);
    const res = await api.get<AdminUser[]>(`/api/admin/users?${params}`);
    if (res.ok && res.data) {
      setUsers(res.data);
      setTotal(res.total || res.data.length);
    }
    setLoadingUsers(false);
  }, [search, offset]);

  useEffect(() => {
    if (!loadingStats && !accessDenied) fetchUsers();
  }, [loadingStats, accessDenied, fetchUsers]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setOffset(0);
  };

  if (isPending || (loadingStats && !accessDenied)) {
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
      <AdminHeader activeTab="users" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {loadingStats ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-white/40" />)
          ) : stats ? (
            <>
              <StatCard icon={Users} value={stats.totalUsers} label={t("totalUsers")} accentColor="text-blue-500" accentBg="bg-blue-50" />
              <StatCard icon={FolderOpen} value={stats.totalProjects} label={t("totalProjects")} accentColor="text-green-500" accentBg="bg-green-50" />
              <StatCard icon={Zap} value={stats.totalCreditsSpent.toFixed(1)} label={t("totalCreditsSpent")} accentColor="text-amber-500" accentBg="bg-amber-50" />
              <StatCard icon={Activity} value={stats.activeProjects} label={t("activeProjects")} accentColor="text-emerald-500" accentBg="bg-emerald-50" />
            </>
          ) : null}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={t("searchUsers")}
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

        {/* Users Table (desktop) */}
        <div className="hidden sm:block bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">{t("name")}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">{t("email")}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">{t("role")}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">{t("projectCount")}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">{t("lastActivity")}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden xl:table-cell">{t("created")}</th>
              </tr>
            </thead>
            <tbody>
              {loadingUsers ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24 bg-gray-100" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32 bg-gray-100" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full bg-gray-100" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-8 bg-gray-100" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-16 bg-gray-100" /></td>
                    <td className="px-4 py-3 hidden xl:table-cell"><Skeleton className="h-4 w-20 bg-gray-100" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <UserCircle className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">{t("noUsers")}</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b border-gray-50 hover:bg-black/[0.02] cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/users/${user._id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">
                          {(user.name || user.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{user.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[180px]">{user.email}</td>
                    <td className="px-4 py-3"><UserRoleBadge role={user.role} /></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.projectCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden lg:table-cell">{timeAgo(user.lastActivity)}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden xl:table-cell">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Users Cards (mobile) */}
        <div className="sm:hidden space-y-3">
          {loadingUsers ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl bg-white/40" />)
          ) : users.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-8 text-center">
              <UserCircle className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{t("noUsers")}</p>
            </div>
          ) : (
            users.map((user) => (
              <Link key={user._id} href={`/admin/users/${user._id}`}>
                <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-4 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-500 shrink-0">
                      {(user.name || user.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{user.name || "—"}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <UserRoleBadge role={user.role} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                    <span>{user.projectCount} {t("projectCount").toLowerCase()}</span>
                    <span>{timeAgo(user.lastActivity)}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-400">
              {from}-{to} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="h-8 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset(offset + limit)}
                className="h-8 text-xs"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
