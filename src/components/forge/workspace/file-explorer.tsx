"use client";

import * as React from "react";
import { File, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FileExplorer({
  roots,
  onOpen,
}: {
  /** Placeholder tree until Phase 7's real project-files API lands. */
  roots: { path: string; dir?: boolean; children?: any[] }[];
  onOpen: (path: string) => void;
}) {
  const render = (nodes: any[], depth = 0) =>
    nodes.map((n) => (
      <div key={n.path} style={{ paddingLeft: depth * 12 }}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start gap-1.5 px-1.5 text-xs"
          onClick={() => !n.dir && onOpen(n.path)}
        >
          {n.dir ? <FolderTree className="size-3.5" /> : <File className="size-3.5" />}
          <span className="truncate">{n.path.split("/").pop()}</span>
        </Button>
        {n.dir && render(n.children ?? [], depth + 1)}
      </div>
    ));

  return (
    <div className="scrollbar-thin h-full overflow-auto p-2">
      {roots.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground">No files yet.</div>
      ) : (
        render(roots)
      )}
    </div>
  );
}
