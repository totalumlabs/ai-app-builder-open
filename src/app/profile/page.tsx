"use client";

import { useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, User, LogOut, Shield, Sparkles, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const user = session?.user;
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut({ fetchOptions: { onSuccess: () => router.push("/") } });
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #faf9f7 0%, #f5f0eb 25%, #ede4db 50%, #e8dfd6 75%, #f2ece6 100%)" }}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  const userName = user.name || user.email?.split("@")[0] || "";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Same gradient background as dashboard */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #faf9f7 0%, #f5f0eb 25%, #ede4db 50%, #e8dfd6 75%, #f2ece6 100%)" }} />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-30" style={{ background: "radial-gradient(circle, #e8d5c4 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #d4c4b0 0%, transparent 70%)" }} />
      </div>

      {/* Header - same as dashboard */}
      <header className="sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold tracking-tight text-gray-900 text-sm">VibeBuild</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
        {/* Avatar and name */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-gray-600">
            {userInitial}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{user.name || "User"}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
        </div>

        {/* Profile details */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
          <div className="p-5 space-y-4">
            <div>
              <Label className="text-xs text-gray-400 uppercase tracking-wider">Name</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-800">{user.name || "Not set"}</span>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <Label className="text-xs text-gray-400 uppercase tracking-wider">Email</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-800">{user.email}</span>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <Label className="text-xs text-gray-400 uppercase tracking-wider">Account Status</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-gray-800">Active</span>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <Label className="text-xs text-gray-400 uppercase tracking-wider">Member Since</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm text-gray-800">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unknown"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <Link href="/forgot-password">
            <button className="w-full text-left px-5 py-3 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 text-sm text-gray-700 hover:bg-white transition-colors">
              Change password
            </button>
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 px-5 py-3 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 text-sm text-red-600 hover:bg-red-50/50 transition-colors"
          >
            {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
