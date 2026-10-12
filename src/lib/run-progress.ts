/**
 * ═══ THE v2 RUN TIMELINE — WHAT THE CHAT MAY SHOW ═══════════════════════════
 *
 * `GET …/agent/progress` (new engine only, free) is a whitelist projection of a run's
 * events: stage, turns, steps, files changed. Trimmed copy of totalum-platform's
 * `lib/run-progress.ts`.
 *
 * ⚠️ THIS IS A SECOND WALL, NOT A FORMATTER. Only known enums, finite counts and file
 * paths that look like a project file pass; anything else is dropped.
 */

export const RUN_STAGES = [
  "queued", "sandbox", "starting", "thinking", "working", "build", "deploy", "fixing",
  "wrapping-up", "entry-page", "done", "failed", "cancelled", "incomplete",
] as const;
export type RunStage = (typeof RUN_STAGES)[number];

export const STEP_KINDS = [
  "read", "search", "create", "edit", "delete", "command", "web", "browser", "integration", "helper", "plan", "waiting",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const COMMAND_TASKS = ["build", "test", "install", "database", "check", "save", "other"] as const;
export type CommandTask = (typeof COMMAND_TASKS)[number];

export interface RunStep {
  at: number;
  kind: StepKind;
  file?: string;
  task?: CommandTask;
  ok?: boolean;
  added?: number;
  removed?: number;
}

export interface RunFile {
  path: string;
  change: "create" | "edit" | "delete";
  added: number;
  removed: number;
}

export interface RunProgressView {
  runId: string;
  stage: RunStage;
  startedAt: number;
  turns: number;
  steps: RunStep[];
  totalSteps: number;
  files: RunFile[];
}

const STEPS_MAX = 40;
const FILES_MAX = 100;

const HIDDEN_PATH =
  /^(_system-docs|\.claude|\.git|\.totalum|node_modules|\.next|\.open-next|\.wrangler)(\/|$)|(^|\/)\.env|(^|\/)\.dev\.vars|(^|\/)(CLAUDE|AGENTS)\.md$/i;
const PATH_CHARS = /^[\w.@()[\]+\-/ ]{1,200}$/;
const OPAQUE = /[A-Za-z0-9_-]{32,}/;
const ID = /^run_[a-z0-9]{8,40}$/i;

/** A project-relative file path safe to render, or `undefined`. */
export function safeFilePath(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const p = raw.startsWith("…") ? raw.slice(1) : raw;
  if (!PATH_CHARS.test(p) || p.startsWith("/") || p.split("/").includes("..")) return undefined;
  if (HIDDEN_PATH.test(p) || OPAQUE.test(p)) return undefined;
  return raw;
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;
const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const time = (v: unknown): number | undefined => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? undefined : t;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function step(raw: unknown): RunStep | null {
  const s = obj(raw);
  const kind = oneOf(STEP_KINDS, s.kind);
  const at = time(s.at);
  if (!kind || at === undefined) return null;
  const file = safeFilePath(s.file);
  const task = kind === "command" ? oneOf(COMMAND_TASKS, s.task) ?? "other" : undefined;
  return {
    at,
    kind,
    ...(file ? { file } : {}),
    ...(task ? { task } : {}),
    ...(typeof s.ok === "boolean" ? { ok: s.ok } : {}),
    ...(s.added !== undefined ? { added: count(s.added) } : {}),
    ...(s.removed !== undefined ? { removed: count(s.removed) } : {}),
  };
}

/** The engine's answer made safe to render, or `null` when it is not a run. */
export function sanitizeRunProgress(raw: unknown): RunProgressView | null {
  const r = obj(raw);
  const stage = oneOf(RUN_STAGES, r.stage);
  const startedAt = time(r.startedAt);
  if (typeof r.runId !== "string" || !ID.test(r.runId) || !stage || startedAt === undefined) return null;
  const files: RunFile[] = [];
  for (const f of Array.isArray(r.files) ? r.files.slice(0, FILES_MAX) : []) {
    const o = obj(f);
    const path = safeFilePath(o.path);
    const change = oneOf(["create", "edit", "delete"] as const, o.change);
    if (path && change) files.push({ path, change, added: count(o.added), removed: count(o.removed) });
  }
  return {
    runId: r.runId,
    stage,
    startedAt,
    turns: count(r.turns),
    steps: (Array.isArray(r.steps) ? r.steps.slice(-STEPS_MAX) : []).map(step).filter((s): s is RunStep => !!s),
    totalSteps: count(r.totalSteps),
    files,
  };
}

export const isRunOver = (stage: RunStage) =>
  stage === "done" || stage === "failed" || stage === "cancelled" || stage === "incomplete";

const STAGE_TEXT: Record<RunStage, string> = {
  queued: "Waiting for a builder…",
  sandbox: "Preparing the workspace…",
  starting: "Starting the AI…",
  thinking: "Thinking…",
  working: "Writing code…",
  build: "Building the app…",
  deploy: "Updating the preview…",
  fixing: "Fixing an issue…",
  "wrapping-up": "Wrapping up…",
  "entry-page": "Setting the home page…",
  done: "Done",
  failed: "Stopped",
  cancelled: "Stopped",
  incomplete: "Stopped",
};
export const stageText = (stage: RunStage) => STAGE_TEXT[stage];

const COMMAND_TEXT: Record<CommandTask, string> = {
  build: "Building the app",
  test: "Testing the app",
  install: "Installing packages",
  database: "Updating the database",
  check: "Checking the code",
  save: "Saving the work",
  other: "Running a command",
};

/** A step in plain words. File names are the only engine-supplied text, and they were sanitised. */
export function stepText(s: RunStep): string {
  switch (s.kind) {
    case "read": return s.file ? `Read ${s.file}` : "Read a file";
    case "create": return s.file ? `Created ${s.file}` : "Created a file";
    case "edit": return s.file ? `Edited ${s.file}` : "Edited a file";
    case "delete": return s.file ? `Deleted ${s.file}` : "Deleted a file";
    case "command": return COMMAND_TEXT[s.task ?? "other"];
    case "search": return "Searched the code";
    case "web": return "Looked something up on the web";
    case "browser": return "Checked the app in a browser";
    case "integration": return "Used an integration";
    case "helper": return "Asked a helper agent";
    case "plan": return "Planned the work";
    case "waiting": return "Waiting";
  }
}
