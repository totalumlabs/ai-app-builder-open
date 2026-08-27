"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { WorkspaceLayout } from "@/components/forge/workspace/layout";
import { FileExplorer } from "@/components/forge/workspace/file-explorer";
import { EditorStack, type OpenFile } from "@/components/forge/workspace/editor-stack";
import { AgentRail, type AgentMode } from "@/components/forge/workspace/agent-rail";
import { PreviewPane } from "@/components/forge/workspace/preview-pane";
import { TerminalPane } from "@/components/forge/workspace/terminal-pane";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [files, setFiles] = React.useState<OpenFile[]>([]);
  const [fileTree, setFileTree] = React.useState<{ path: string; dir?: boolean; children?: any[] }[]>([]);
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [agentPending, setAgentPending] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [terminalLines, setTerminalLines] = React.useState<string[]>([]);

  const openFile = (path: string, content = "") => {
    setFiles((prev) => (prev.some((f) => f.path === path) ? prev : [...prev, { path, content }]));
    setActivePath(path);
  };

  const openProjectFile = (path: string) => {
    fetch(
      `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`
    )
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.[0]) {
          openFile(path, j.data[0].content);
        } else {
          openFile(path, "");
        }
      })
      .catch(() => toast.error("Failed to load file"));
  };

  // File list — load once on mount.
  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/files`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (Array.isArray(j?.data)) {
          const tree = j.data.map((f: { path: string }) => ({
            path: f.path,
            dir: false,
          }));
          setFileTree(tree);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const closeFile = (path: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.path !== path);
      if (activePath === path) setActivePath(next[0]?.path ?? null);
      return next;
    });
  };

  const editFile = (path: string, value: string) =>
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, content: value, dirty: true } : f)));

  const sendToAgent = async (prompt: string, mode: AgentMode) => {
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setAgentPending(true);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt, mode }),
      });
      if (!res.ok || !res.body) throw new Error("Agent run failed to start");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Consume complete SSE lines (`data: {…}\n\n`).
        for (;;) {
          const nl = buffer.indexOf("\n");
          if (nl < 0) break;
          const line = buffer.slice(0, nl).trimEnd();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim()) as
              | { type: "delta"; text: string }
              | { type: "terminal"; text: string }
              | { type: "preview"; url: string };

            if (evt.type === "delta") {
              setMessages((m) => {
                const next = [...m];
                const last = next[next.length - 1];
                next[next.length - 1] = {
                  ...last,
                  content: last.content + evt.text,
                };
                return next;
              });
            } else if (evt.type === "terminal") {
              setTerminalLines((l) => [...l, evt.text]);
            } else if (evt.type === "preview") {
              setPreviewUrl(evt.url);
            }
          } catch {
            // Partial JSON — wait for more
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Agent failed");
    } finally {
      setAgentPending(false);
    }
  };

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        toast.success("Saved.", { duration: 1200 });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toast.info("Command palette — lands with the API phases.", { duration: 1200 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <WorkspaceLayout
      projectName={projectId}
      leftRail={
        <FileExplorer
          roots={fileTree}
          onOpen={openProjectFile}
        />
      }
      centerContent={
        <EditorStack
          files={files}
          activePath={activePath}
          onSelect={setActivePath}
          onClose={closeFile}
          onChange={editFile}
        />
      }
      agentContent={<AgentRail messages={messages} pending={agentPending} onSend={sendToAgent} />}
      dockContent={<TerminalPane lines={terminalLines} />}
      previewContent={<PreviewPane url={previewUrl} onRefresh={() => {}} />}
    />
  );
}
