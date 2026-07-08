"use client";

import { useState, useRef, useEffect } from "react";
import { Languages, Check, ChevronDown } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";

const LANGS: { code: Lang; label: string; flag: string; native: string }[] = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
];

interface LanguageSelectProps {
  /** "menu" = full-width row for inside a popup menu; "button" = standalone pill button */
  variant?: "menu" | "button";
  dark?: boolean;
}

export function LanguageSelect({ variant = "button", dark = false }: LanguageSelectProps) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const panelBg = dark ? "#2a2a2a" : "#fff";
  const panelBorder = dark ? "#444" : "#e5e5e5";

  const dropdown = open && (
    <div
      className="absolute z-[70] w-44 rounded-xl shadow-xl overflow-hidden right-0 mt-1.5"
      style={{ background: panelBg, border: `1px solid ${panelBorder}` }}
    >
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => { setLang(l.code); setOpen(false); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
            l.code === lang ? "font-medium text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"
          }`}
        >
          <span className="text-base leading-none">{l.flag}</span>
          <span className="flex-1 text-left">{l.native}</span>
          {l.code === lang && <Check className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
        </button>
      ))}
    </div>
  );

  if (variant === "menu") {
    // Inline expansion (accordion) — avoids being clipped by the parent
    // popup menu's `overflow-hidden`.
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200"
        >
          <span className="flex items-center gap-2.5"><Languages className="w-4 h-4 text-gray-400" /> {current.native}</span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className="text-sm">{current.flag}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </button>
        {open && (
          <div className="bg-black/[0.02] dark:bg-white/[0.03]">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 pl-9 pr-3 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                  l.code === lang ? "font-medium text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"
                }`}
              >
                <span className="text-base leading-none">{l.flag}</span>
                <span className="flex-1 text-left">{l.native}</span>
                {l.code === lang && <Check className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <span className="text-sm">{current.flag}</span>
        <span className="hidden sm:inline">{current.native}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {dropdown}
    </div>
  );
}
