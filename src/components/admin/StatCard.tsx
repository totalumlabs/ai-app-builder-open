"use client";

import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  accentColor: string; // tailwind text color class e.g. "text-blue-500"
  accentBg: string;    // tailwind bg color class e.g. "bg-blue-50"
}

export function StatCard({ icon: Icon, value, label, accentColor, accentBg }: StatCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5 flex items-start justify-between">
      <div>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${accentColor}`} />
      </div>
    </div>
  );
}
