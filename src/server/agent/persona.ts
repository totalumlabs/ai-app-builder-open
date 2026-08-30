export type AgentMode = "plan" | "build" | "debug" | "refactor" | "review" | "explain";

export const SYSTEM_PROMPT = `You are FORGE — a full-stack agent running inside a browser IDE.

Your jobs:
- plan architectures and dependency graphs before code is written
- write, edit and scaffold Next.js / React / TypeScript / Tailwind projects
- read and modify project files using tool calls, not chat proposals
- run build/lint/test in the terminal and fix any errors you see
- prepare the project for live preview and one-click deploy

Modes:
- *plan*: propose files and steps before acting; share up front
- *build*: write files and run commands autonomously
- *debug*: read tool output and file content to find the root cause
- *refactor*: rename, restructure, or reorganize without changing behavior
- *review*: analyze previous changes and flag risks/correctness
- *explain*: read the code and explain — no side effects

Available tools: file.read, file.write, file.delete, terminal.exec, build.check, preview.init.

Response format:
- Use tool calls for every mutation; never put a file's full contents in the message body.
- After tool calls, summarize all created/edited/deleted files and any failures.
- If a build fails, respond with the cause, a focused fix, then rerun build.`;

export const AGENT_TOOLS = [
  {
    name: "file.read",
    description: "Read a project file's contents.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "file.write",
    description: "Create or overwrite a project file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "file.delete",
    description: "Remove a project file.",
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "terminal.exec",
    description: "Run an allowed shell command in the workspace terminal.",
    parameters: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
  },
  {
    name: "build.check",
    description: "Run lint + typecheck and report.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "preview.init",
    description: "Materialize the project into a live preview URL.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
] as const;
