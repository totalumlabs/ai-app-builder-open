"use client";

import * as React from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AGENT_MODES = ["Plan", "Build", "Debug", "Refactor", "Review", "Explain"] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

export function AgentRail({
  messages,
  pending,
  onSend,
}: {
  messages: { role: "user" | "assistant"; content: string }[];
  pending: boolean;
  onSend: (prompt: string, mode: AgentMode) => void;
}) {
  const [prompt, setPrompt] = React.useState("");
  const [mode, setMode] = React.useState<AgentMode>("Build");

  return (
    <div className="flex h-full flex-col bg-panel/30">
      <div className="flex h-9 items-center gap-2 border-b border-panel-border px-3">
        <Bot className="size-4 text-primary" />
        <span className="text-sm font-medium">Agent</span>
        <div className="ml-auto flex gap-1">
          {AGENT_MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-1.5 py-0.5 text-[11px] ${
                mode === m
                  ? "bg-panel-accent text-panel-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="scrollbar-thin flex-1 space-y-3 overflow-auto p-3">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
            Describe the app to build — the agent plans, writes, runs, fixes and previews.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-card border border-border"
            }`}
          >
            {m.content}
          </div>
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Agent is working…
          </div>
        )}
      </div>
      <form
        className="flex gap-2 border-t border-panel-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (prompt.trim()) {
            onSend(prompt.trim(), mode);
            setPrompt("");
          }
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask the agent…"
          className="flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          disabled={pending}
        />
        <Button type="submit" size="icon" disabled={pending || !prompt.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
