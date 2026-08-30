"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { X } from "lucide-react";

export interface OpenFile {
  path: string;
  content: string;
  dirty?: boolean;
}

export function EditorStack({
  files,
  activePath,
  onSelect,
  onClose,
  onChange,
}: {
  files: OpenFile[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onChange: (path: string, value: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const active = files.find((f) => f.path === activePath) ?? null;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="scrollbar-thin flex h-9 items-end overflow-x-auto border-b border-panel-border bg-panel/40">
        {files.map((f) => (
          <button
            key={f.path}
            onClick={() => onSelect(f.path)}
            className={`group flex h-9 items-center gap-2 border-r border-panel-border px-3 text-xs ${
              activePath === f.path
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-panel-accent/60"
            }`}
          >
            <span className="max-w-40 truncate">{f.path.split("/").pop()}</span>
            {f.dirty && <span className="size-1.5 rounded-full bg-primary" />}
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClose(f.path);
              }}
              className="opacity-0 group-hover:opacity-100"
            >
              <X className="size-3" />
            </span>
          </button>
        ))}
      </div>
      {active ? (
        <Editor
          path={active.path}
          value={active.content}
          onChange={(v) => onChange(active.path, v ?? "")}
          theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
          language={guessLanguage(active.path)}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 8 },
          }}
        />
      ) : (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">
          Open a file from the explorer
        </div>
      )}
    </div>
  );
}

function guessLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts": case "tsx": return "typescript";
    case "js": case "jsx": return "javascript";
    case "json": return "json";
    case "css": return "css";
    case "html": return "html";
    case "md": return "markdown";
    case "py": return "python";
    default: return "plaintext";
  }
}
