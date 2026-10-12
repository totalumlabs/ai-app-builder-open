"use client";

import * as React from "react";
import {
  AppWindowIcon, FileMinusIcon, FilePenIcon, FilePlusIcon, FileTextIcon, GlobeIcon, HourglassIcon,
  ListChecksIcon, PlugIcon, SearchIcon, SquareTerminalIcon, UsersIcon,
} from "lucide-react";
import { vcaasApi } from "@/lib/vcaas";
import { isRunOver, sanitizeRunProgress, stageText, stepText, type RunProgressView, type StepKind } from "@/lib/run-progress";
import { cn } from "@/lib/utils";

const POLL_MS = 3_000;
const RECENT_STEPS = 6;

/**
 * Polls `GET …/agent/progress` every 3 s while a new-engine run is in flight. Owned by
 * the workspace page (both ChatPanels are mounted, so one poller, not two). Paused while
 * the tab is hidden.
 */
export function useRunProgress(projectId: string, isRunning: boolean, enabled: boolean): RunProgressView | null {
  const [progress, setProgress] = React.useState<RunProgressView | null>(null);
  React.useEffect(() => {
    if (!enabled || !isRunning) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async () => {
      if (!document.hidden) {
        const res = await vcaasApi.v2.agentProgress(projectId).catch(() => null);
        if (cancelled) return;
        if (res?.ok) setProgress(sanitizeRunProgress(res.data));
      }
      if (!cancelled) timer = setTimeout(() => void loop(), POLL_MS);
    };
    void loop();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [projectId, isRunning, enabled]);
  return enabled ? progress : null;
}

const STEP_ICON: Record<StepKind, React.ComponentType<{ className?: string }>> = {
  read: FileTextIcon, search: SearchIcon, create: FilePlusIcon, edit: FilePenIcon, delete: FileMinusIcon,
  command: SquareTerminalIcon, web: GlobeIcon, browser: AppWindowIcon, integration: PlugIcon,
  helper: UsersIcon, plan: ListChecksIcon, waiting: HourglassIcon,
};

/**
 * ═══ WHAT THE AGENT IS DOING, LIVE (new-engine projects) ════════════════════
 *
 * The stage in words, then the latest steps (files read/created/edited, builds,
 * tests) and a count of files changed — the closest equivalent of totalum-platform's
 * `RunTimeline`. `progress` may still be the PREVIOUS run for one poll after a prompt
 * starts: an ended run is shown as "Starting the AI…" with no steps, never as done.
 */
export function RunActivity({ progress }: { progress: RunProgressView | null }) {
  const live = progress && !isRunOver(progress.stage) ? progress : null;
  const stage = live?.stage ?? "starting";
  const recent = (live?.steps ?? []).slice(-RECENT_STEPS).reverse();
  const files = live?.files.length ?? 0;

  return (
    <section aria-label="Agent activity" data-testid="run-activity" className="mt-3 rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <span className="size-3.5 shrink-0 rounded-full border-2 border-primary/25 border-t-primary animate-spin motion-reduce:animate-none" aria-hidden />
        <p aria-live="polite" className="min-w-0 flex-1 truncate text-sm font-medium" data-testid="run-activity-stage">{stageText(stage)}</p>
        {live && live.turns > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {files > 0 ? `${files} file${files === 1 ? "" : "s"} · ` : ""}{live.totalSteps} step{live.totalSteps === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {recent.length > 0 && (
        <ol className="mt-2.5 space-y-1.5">
          {recent.map((s, i) => {
            const Icon = STEP_ICON[s.kind];
            const failed = s.ok === false;
            return (
              <li
                key={`${s.at}-${s.kind}-${i}`}
                className={cn("flex items-start gap-2 text-xs leading-snug", i === 0 ? "text-foreground" : "text-muted-foreground", "motion-safe:animate-in motion-safe:fade-in")}
              >
                <Icon className={cn("mt-px size-3.5 shrink-0", failed ? "text-destructive" : "text-muted-foreground")} aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={stepText(s)}>
                  {stepText(s)}
                  {failed && <span className="text-destructive"> · failed</span>}
                </span>
                {(s.added || s.removed) ? (
                  <span className="shrink-0 text-[11px] tabular-nums">
                    {s.added ? <span className="text-emerald-600 dark:text-emerald-400">+{s.added}</span> : null}
                    {s.added && s.removed ? " " : null}
                    {s.removed ? <span className="text-destructive">−{s.removed}</span> : null}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
