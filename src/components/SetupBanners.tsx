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
      <div className="relative overflow-hidden ei-panel">
        <div className="absolute inset-y-0 left-0 w-1 bg-[#00DFFF]" />
        <div className="flex items-start gap-4 p-5 sm:p-6 pl-6 sm:pl-7">
          <div className="shrink-0 w-11 h-11 rounded-sm bg-[#00DFFF] flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-[#05080D]" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-[0.18em] text-[#00DFFF] border border-cyan-400/30 px-2 py-0.5">
              Action required
            </span>
            <h2 className="text-lg font-display font-bold text-white mt-2">Add your Totalum API key to get started</h2>
            <p className="text-sm text-[#94A3B8] mt-1.5">
              Create a{" "}
              <code className="font-mono text-[13px] font-semibold bg-[#05080D] text-[#00DFFF] px-1.5 py-0.5 rounded-sm border border-cyan-400/20">.env</code>{" "}
              file in the project root and add:
            </p>
            <div className="mt-2.5 rounded-sm bg-[#05080D] font-mono text-xs px-3.5 py-2.5 overflow-x-auto border border-cyan-400/20">
              <span className="text-[#00DFFF]">TOTALUM_VCAAS_API_KEY</span>
              <span className="text-[#94A3B8]">=</span>
              <span className="text-[#94A3B8]/70">your_key_here</span>
            </div>
            <p className="text-[13px] text-[#94A3B8] mt-3 leading-relaxed">
              <span className="font-semibold text-white">Get your key:</span> create an account on Totalum → during
              onboarding pick <span className="font-semibold text-white">“Use the Totalum API”</span> → copy your key.
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3.5">
              <a
                href="https://www.totalum.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#05080D] bg-[#00DFFF] hover:bg-[#008CFF] hover:text-white px-4 py-2 rounded-sm transition-all hover:shadow-[0_0_20px_rgba(0,140,255,0.4)]"
              >
                Create account <ArrowRight className="w-4 h-4" />
              </a>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#00DFFF]">
                <Sparkles className="w-3.5 h-3.5" />
                First 50 AI credits free
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="ei-panel p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 w-9 h-9 rounded-sm bg-[#00DFFF]/10 border border-cyan-400/25 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#00DFFF]" />
          </div>
          <div>
            <h2 className="text-base font-display font-bold leading-tight text-white">One key. Everything included.</h2>
            <p className="text-[13px] text-[#94A3B8]">No other providers needed.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-sm bg-[#05080D] border border-cyan-400/15 px-3 py-2"
            >
              <Icon className="w-4 h-4 text-[#00DFFF] shrink-0" />
              <span className="text-[13px] font-medium text-white/90 truncate">{label}</span>
            </div>
          ))}
        </div>

        <a
          href="https://www.totalum.app/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-[#00DFFF] hover:text-white transition-colors"
        >
          See more at totalum.app/docs <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
