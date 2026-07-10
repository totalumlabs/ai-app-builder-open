"use client";

import { KeyRound, Sparkles, ArrowRight } from "lucide-react";

// Shown on the dashboard only when the Totalum VCaaS API key is missing.
// 1) an actionable setup card telling the user how to add their key, and
// 2) a short value pitch for what that single key unlocks.
export function SetupBanners() {
  const INCLUDED = [
    "Hosting", "Databases", "AI integration",
    "Custom domains", "GitHub sync", "Sandboxes",
  ];

  return (
    <div className="space-y-3 mb-8">
      {/* ── Setup: add your key ── */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Activate your AI app builder</h2>
            <p className="text-sm text-gray-600 mt-1">
              Create a <code className="font-mono text-[13px] bg-amber-100/70 px-1 py-0.5 rounded">.env</code> file
              in the project root and add your Totalum VCaaS API key:
            </p>
            <div className="mt-2.5 rounded-lg bg-gray-900 text-gray-100 font-mono text-xs px-3 py-2 overflow-x-auto">
              TOTALUM_VCAAS_API_KEY=<span className="text-gray-500">your_key_here</span>
            </div>
            <p className="text-[13px] text-gray-500 mt-3 leading-relaxed">
              <span className="font-medium text-gray-700">Get your key:</span> register on Totalum, and during
              onboarding choose <span className="font-medium text-gray-700">“Use the Totalum API”</span> — then
              copy your API key.
            </p>
            <a
              href="https://www.totalum.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors"
            >
              Register on Totalum <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* ── Value: one key, everything included ── */}
      <div
        className="rounded-2xl p-5 sm:p-6 text-white"
        style={{ background: "linear-gradient(135deg,#4338CA 0%,#6D28D9 55%,#8B5CF6 100%)" }}
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold">One key. Everything your projects need.</h2>
            <p className="text-sm text-white/85 mt-1 leading-relaxed">
              With only your Totalum API key, every project you build gets hosting, databases, AI, custom domains,
              bidirectional GitHub sync, sandboxes and more — no other providers needed. Drop it into your existing
              software or SaaS and let your users build multiple full-stack projects with everything included.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {INCLUDED.map((f) => (
                <span key={f} className="text-[11px] font-medium bg-white/15 rounded-full px-2.5 py-0.5">
                  {f}
                </span>
              ))}
            </div>
            <a
              href="https://www.totalum.app/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3.5 text-sm font-medium text-white/95 hover:text-white underline underline-offset-4"
            >
              See more at totalum.app/docs <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
