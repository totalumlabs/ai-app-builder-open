"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Monitor } from "lucide-react";

interface PreviewPanelProps {
  previewUrl: string | null;
  productionUrl?: string;
  onRefresh: () => void;
}

export function PreviewPanel({ previewUrl, productionUrl, onRefresh }: PreviewPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* URL bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50/80">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="flex-1 min-w-0 bg-white border rounded-md px-3 py-1">
            <span className="text-xs text-gray-400 font-mono truncate block">
              {previewUrl || "No preview available yet"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onRefresh}>
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          </Button>
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="w-7 h-7">
                <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* iframe */}
      <div className="flex-1 bg-white relative">
        {previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            title="Project Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
              <Monitor className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">No preview available</p>
            <p className="text-xs text-gray-400">
              Send a prompt to start building your project and see a live preview here.
            </p>
          </div>
        )}
      </div>

      {/* Production URL footer */}
      {productionUrl && (
        <div className="px-3 py-2 border-t bg-gray-50/80 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
            Production
          </span>
          <a
            href={`https://${productionUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-600 hover:text-violet-800 hover:underline flex items-center gap-1"
          >
            {productionUrl}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
