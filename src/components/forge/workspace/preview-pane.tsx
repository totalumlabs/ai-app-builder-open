"use client";

import * as React from "react";
import { ExternalLink, MonitorPlay, RefreshCw, Smartphone, Tablet, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PreviewPane({
  url,
  onRefresh,
}: {
  url: string | null;
  onRefresh: () => void;
}) {
  const [viewport, setViewport] = React.useState<"mobile" | "tablet" | "desktop">("desktop");

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center gap-1 border-b border-panel-border px-2">
        <Button variant="ghost" size="icon" title="Refresh" onClick={onRefresh}>
          <RefreshCw className="size-3.5" />
        </Button>
        <div className="ml-2 flex gap-1">
          {(["mobile", "tablet", "desktop"] as const).map((v) => (
            <Button
              key={v}
              variant="ghost"
              size="icon"
              title={v}
              onClick={() => setViewport(v)}
              className={viewport === v ? "bg-panel-accent text-panel-accent-foreground" : ""}
            >
              {v === "mobile" ? <Smartphone className="size-3.5" /> : v === "tablet" ? <Tablet className="size-3.5" /> : <Monitor className="size-3.5" />}
            </Button>
          ))}
        </div>
        {url && (
          <Button asChild variant="ghost" size="icon" title="Open in new tab">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
      </div>
      <div className="flex-1">
        {url ? (
          <iframe
            key={url}
            src={url}
            title="Preview"
            className={`h-full w-full transition-all ${
              viewport === "mobile"
                ? "mx-auto max-w-96"
                : viewport === "tablet"
                  ? "mx-auto max-w-2xl"
                  : ""
            }`}
          />
        ) : (
          <div className="grid h-full place-items-center gap-2 text-center text-xs text-muted-foreground">
            <MonitorPlay className="size-8" />
            Start the dev server to see a live preview.
          </div>
        )}
      </div>
    </div>
  );
}
