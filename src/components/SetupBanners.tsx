"use client";

import { KeyRound, Server, Database, Sparkles, Globe, Github, Box, ArrowRight } from "lucide-react";

// Shown on the dashboard only when the Totalum VCaaS API key is missing.
// 1) a high-contrast setup card telling the user how to add their key, and
// 2) a compact, visual pitch for what that single key unlocks.
export function SetupBanners() {
  const FEATURES = [
    { icon: Server, label: "Hosting" },
    { icon: Database, label: "Databases" },
    { icon: Sparkles, label: "AI integration" },
    { icon: Globe, label: "Custom domains" },
    { icon: Github, label: "GitHub sync" },
    { icon: Box, label: "Sandboxes" },
  ];

  return (
    <div className="space-y-4 mt-10">
      {/* ── Setup: add your key (high-contrast, unmissable) ── */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400 bg-white shadow-lg shadow-amber-500/10">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-amber-400" />
        <div className="flex items-start gap-4 p-5 sm:p-6 pl-6 sm:pl-7">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-amber-400 flex items-center justify-center shadow-sm">
            <KeyRound className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
              Action required
            </span>
            <h2 className="text-lg font-bold text-gray-900 mt-2">Add your Totalum API key to get started</h2>
            <p className="text-sm text-gray-700 mt-1.5">
              Create a{" "}
              <code className="font-mono text-[13px] font-semibold bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded">.env</code>{" "}
              file in the project root and add:
            </p>
            <div className="mt-2.5 rounded-lg bg-gray-950 font-mono text-xs px-3.5 py-2.5 overflow-x-auto ring-1 ring-white/10">
              <span className="text-amber-300">TOTALUM_VCAAS_API_KEY</span>
              <span className="text-gray-400">=</span>
              <span className="text-gray-500">your_key_here</span>
            </div>
            <p className="text-[13px] text-gray-600 mt-3 leading-relaxed">
              <span className="font-semibold text-gray-800">Get your key:</span> create an account on Totalum → during
              onboarding pick <span className="font-semibold text-gray-800">“Use the Totalum API”</span> → copy your key.
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3.5">
              <a
                href="https://www.totalum.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 px-4 py-2 rounded-lg shadow-sm transition-colors"
              >
                Create account <ArrowRight className="w-4 h-4" />
              </a>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
                <Sparkles className="w-3.5 h-3.5" />
                First 50 AI credits free
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Value: one key, everything included (visual, minimal text, no purple) ── */}
      <div
        className="rounded-2xl p-5 sm:p-6 text-white"
        style={{ background: "linear-gradient(135deg,#0f172a 0%,#0f3f39 100%)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-400/15 ring-1 ring-emerald-400/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight">One key. Everything included.</h2>
            <p className="text-[13px] text-white/60">No other providers needed.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2"
            >
              <Icon className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="text-[13px] font-medium text-white/90 truncate">{label}</span>
            </div>
          ))}
        </div>

        <a
          href="https://www.totalum.app/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
        >
          See more at totalum.app/docs <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
