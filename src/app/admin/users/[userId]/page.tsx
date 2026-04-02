"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  ArrowLeft, Loader2, FolderOpen, Zap, Clock,
  Pencil, X, Save, Sparkles, ArrowRight,
  CheckCircle, XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface UserDetailData {
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
    email_verified: number | boolean;
    createdAt: string;
    updatedAt: string;
  };
  projects: Array<{
    _id: string;
    project_id: string;
    description: string;
    createdAt: string;
    vcaas: {
      projectId: string;
      description: string;
      agentProcessStatus?: string;
      agentServerStatus?: string;
      deployment?: { status: string } | null;
      totalCreditsSpent?: number;
      temporalDevelopmentProjectUrl?: string | null;
      cachedDevelopmentUrl?: string | null;
      developmentUrlFieldToUse?: string | null;
    } | null;
  }>;
  lastSession: { updatedAt?: string; createdAt?: string } | null;
  totalCreditsSpent: number;
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { t } = useI18n();

  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "" });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await api.get<UserDetailData>(`/api/admin/users/${userId}`);
      if (res.ok && res.data) {
        setData(res.data);
        setEditForm({
          name: res.data.user.name || "",
          email: res.data.user.email || "",
          role: res.data.user.role || "user",
        });
      } else {
        toast.error("Failed to load user");
        router.push("/admin");
      }
      setLoading(false);
    }
    fetchData();
  }, [userId, router]);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    const updates: Record<string, string> = {};
    if (editForm.name !== data.user.name) updates.name = editForm.name;
    if (editForm.email !== data.user.email) updates.email = editForm.email;
    if (editForm.role !== data.user.role) updates.role = editForm.role;

    if (Object.keys(updates).length === 0) {
      setEditing(false);
      setSaving(false);
      return;
    }

    const res = await api.put(`/api/admin/users/${userId}`, updates);
    if (res.ok) {
      toast.success(t("userUpdated"));
      setData((prev) => prev ? { ...prev, user: { ...prev.user, ...updates } } : prev);
      setEditing(false);
    } else {
      toast.error(res.error || "Failed to update");
    }
    setSaving(false);
  };

  const cancelEdit = () => {
    if (data) {
      setEditForm({
        name: data.user.name || "",
        email: data.user.email || "",
        role: data.user.role || "user",
      });
    }
    setEditing(false);
  };

  const getPreviewUrl = (proj: UserDetailData["projects"][0]) => {
    if (!proj.vcaas) return null;
    const field = proj.vcaas.developmentUrlFieldToUse || "temporalDevelopmentProjectUrl";
    const v = proj.vcaas as unknown as Record<string, unknown>;
    return (v[field] as string) || proj.vcaas.temporalDevelopmentProjectUrl || proj.vcaas.cachedDevelopmentUrl || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#fcfbf8" }}>
        <AdminHeader activeTab="users" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <Skeleton className="h-8 w-48 mb-6 bg-white/40" />
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 bg-white/40 rounded-xl" />)}
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 bg-white/40 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { user, projects, lastSession, totalCreditsSpent } = data;
  const lastActivityDate = lastSession?.updatedAt || lastSession?.createdAt || null;

  return (
    <div className="min-h-screen" style={{ background: "#fcfbf8" }}>
      <AdminHeader activeTab="users" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Back + Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <button className="w-8 h-8 rounded-lg border border-gray-200/60 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">{user.name || user.email}</h1>
                <UserRoleBadge role={user.role} />
              </div>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="h-8 text-xs">
              <Pencil className="w-3.5 h-3.5 mr-1" /> {t("editUser")}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit} className="h-8 text-xs">
                <X className="w-3.5 h-3.5 mr-1" /> {t("cancel")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs bg-gray-900 hover:bg-gray-800 text-white">
                {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                {t("saveChanges")}
              </Button>
            </div>
          )}
        </div>

        {/* User Info Card */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5 mb-6">
          {editing ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t("name")}</label>
                <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t("email")}</label>
                <Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t("role")}</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-gray-200"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              <InfoRow label={t("name")} value={user.name || "—"} />
              <InfoRow label={t("email")} value={user.email} />
              <InfoRow label={t("role")} value={<UserRoleBadge role={user.role} />} />
              <InfoRow
                label="Email Verified"
                value={
                  user.email_verified ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle className="w-3.5 h-3.5" /> Yes</span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400 text-sm"><XCircle className="w-3.5 h-3.5" /> No</span>
                  )
                }
              />
              <InfoRow label={t("created")} value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"} />
              <InfoRow label={t("lastActivity")} value={timeAgo(lastActivityDate)} />
            </div>
          )}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <StatCard icon={FolderOpen} value={projects.length} label={t("projectCount")} accentColor="text-blue-500" accentBg="bg-blue-50" />
          <StatCard icon={Zap} value={totalCreditsSpent.toFixed(1)} label={t("creditsSpent")} accentColor="text-amber-500" accentBg="bg-amber-50" />
          <StatCard icon={Clock} value={timeAgo(lastActivityDate)} label={t("lastActivity")} accentColor="text-gray-500" accentBg="bg-gray-50" />
        </div>

        {/* User's projects */}
        <h2 className="text-base font-semibold text-gray-700 mb-4">{t("projectCount")} ({projects.length})</h2>
        {projects.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-10 text-center">
            <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{t("noProjects")}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const thumbUrl = getPreviewUrl(proj);
              const vcaas = proj.vcaas;
              return (
                <Link key={proj._id} href={`/project/${proj.project_id}`}>
                  <div className="bg-white/70 backdrop-blur-sm border border-gray-200/50 rounded-xl overflow-hidden hover:shadow-lg hover:bg-white/90 transition-all cursor-pointer group h-full">
                    {/* Thumbnail */}
                    <div className="h-28 bg-gray-100 relative overflow-hidden">
                      {thumbUrl ? (
                        <iframe
                          src={thumbUrl}
                          className="w-[200%] h-[200%] border-0 pointer-events-none origin-top-left"
                          style={{ transform: "scale(0.5)" }}
                          title={proj.project_id}
                          sandbox="allow-scripts allow-same-origin"
                          tabIndex={-1}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-gray-200" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-medium text-gray-800 truncate flex-1">{proj.project_id}</h3>
                        <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 ml-1" />
                      </div>
                      <p className="text-[11px] text-gray-400 line-clamp-1 mb-2">{proj.description || "No description"}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {vcaas?.agentProcessStatus && (
                          <StatusBadge status={vcaas.agentProcessStatus} type="agent" />
                        )}
                        {vcaas?.deployment?.status && (
                          <StatusBadge status={vcaas.deployment.status} type="deploy" />
                        )}
                        {vcaas?.totalCreditsSpent !== undefined && (
                          <span className="text-[10px] text-gray-400">{vcaas.totalCreditsSpent.toFixed(1)} credits</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
      <div className="text-sm text-gray-800">{value}</div>
    </div>
  );
}

function StatusBadge({ status, type }: { status: string; type: "agent" | "deploy" }) {
  let color = "bg-gray-100 text-gray-500";
  if (type === "agent") {
    if (status === "init") color = "bg-amber-50 text-amber-600";
    else if (status === "done") color = "bg-green-50 text-green-600";
  } else {
    if (status === "deploying") color = "bg-amber-50 text-amber-600";
    else if (status === "success") color = "bg-green-50 text-green-600";
    else if (status === "error") color = "bg-red-50 text-red-600";
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      {status}
    </span>
  );
}
