"use client";

import * as React from "react";
import Link from "next/link";
import { ForgeLogo } from "@/components/forge/logo";
import { ThemeToggle } from "@/components/forge/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Play,
  Rocket,
  Settings,
  Files,
  Search,
  Bot,
  Terminal,
  Eye,
  Database,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type WorkspaceRail = "files" | "search" | "database";
export type DockTab = "terminal" | "problems" | "logs";

/** Slim activity bar on the far left of the IDE. */
export function ActivityBar({
  rail,
  onRail,
}: {
  rail: WorkspaceRail;
  onRail: (r: WorkspaceRail) => void;
}) {
  const items = [
    { id: "files" as const, icon: Files, label: "Files" },
    { id: "search" as const, icon: Search, label: "Search" },
    { id: "database" as const, icon: Database, label: "Database" },
  ];
  return (
    <div className="flex w-11 flex-col items-center gap-1 border-r border-panel-border bg-panel py-2">
      {items.map((i) => (
        <Button
          key={i.id}
          variant="ghost"
          size="icon"
          title={i.label}
          onClick={() => onRail(i.id)}
          className={rail === i.id ? "bg-panel-accent text-panel-accent-foreground" : ""}
        >
          <i.icon className="size-4" />
        </Button>
      ))}
    </div>
  );
}

/** Top bar: project name, save status, provider/model, run/build/deploy. */
export function WorkspaceTopBar({
  projectName,
  saveState,
}: {
  projectName: string;
  saveState: "idle" | "saving" | "saved" | "error";
}) {
  return (
    <div className="flex h-11 items-center gap-2 border-b border-panel-border bg-panel px-3">
      <Link href="/dashboard" className="flex items-center gap-2">
        <ForgeLogo size={20} />
      </Link>
      <Badge variant="secondary" className="max-w-48 truncate">
        {projectName}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : ""}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="sm" title="Run">
          <Play className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" title="Deploy">
          <Rocket className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="size-4" />
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
}

/** Bottom dock tabs (terminal / problems / logs). */
export function DockTabs({
  tab,
  onTab,
  children,
}: {
  tab: DockTab;
  onTab: (t: DockTab) => void;
  children: React.ReactNode;
}) {
  const tabs = [
    { id: "terminal" as const, icon: Terminal, label: "Terminal" },
    { id: "problems" as const, icon: Eye, label: "Problems" },
    { id: "logs" as const, icon: Bot, label: "Agent log" },
  ];
  return (
    <div className="flex h-full flex-col border-t border-panel-border bg-panel">
      <div className="flex h-9 items-center gap-1 px-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant="ghost"
            size="sm"
            onClick={() => onTab(t.id)}
            className={tab === t.id ? "bg-panel-accent text-panel-accent-foreground" : ""}
          >
            <t.icon className="size-3.5" /> {t.label}
          </Button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
