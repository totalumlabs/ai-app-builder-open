"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Shield, Sparkles, LogOut, LayoutDashboard, Users, FolderOpen } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface AdminHeaderProps {
  activeTab?: "dashboard" | "users" | "projects";
}

export function AdminHeader({ activeTab = "dashboard" }: AdminHeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "";
  const userInitial = userName.charAt(0).toUpperCase();

  const tabs = [
    { id: "dashboard" as const, label: t("adminDashboard"), icon: LayoutDashboard, href: "/admin" },
    { id: "users" as const, label: t("adminUsers"), icon: Users, href: "/admin" },
    { id: "projects" as const, label: t("adminProjects"), icon: FolderOpen, href: "/admin/projects" },
  ];

  return (
    <header className="sticky top-0 z-50" style={{ background: "rgba(252,251,248,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Top row */}
        <div className="h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold tracking-tight text-gray-900 text-sm">VibeBuild</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 ml-2">
              <Shield className="w-3.5 h-3.5 text-red-500" />
              <span className="text-sm font-medium text-gray-700">{t("adminPanel")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <button className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-black/5 transition-colors">
                {t("back")}
              </button>
            </Link>
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
        {/* Tab navigation */}
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map((tab) => (
            <Link key={tab.id} href={tab.href}>
              <button
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
