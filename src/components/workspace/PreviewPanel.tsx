"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, RefreshCw, Monitor, Smartphone, Loader2 } from "lucide-react";

interface PreviewPanelProps {
  previewUrl: string | null;
  productionUrl?: string;
  onRefresh: () => void;
  loading?: boolean;
}

export function PreviewPanel({ previewUrl, productionUrl, onRefresh, loading }: PreviewPanelProps) {
  const [mobilePreview, setMobilePreview] = useState(false);
  const [iframePath, setIframePath] = useState("/");
  const [iframeLoading, setIframeLoading] = useState(true);

  const fullIframeUrl = previewUrl ? `${previewUrl}${iframePath === "/" ? "" : iframePath}` : null;

  return (
    <div className="h-full flex flex-col">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50/80">
        <div className="flex gap-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
        </div>

        {/* Editable path */}
        <div className="flex-1 min-w-0">
          <Input
            value={iframePath}
            onChange={(e) => setIframePath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setIframeLoading(true);
              }
            }}
            className="h-7 text-xs font-mono bg-white border-gray-200 rounded-md"
            placeholder="/"
          />
        </div>

        {/* Device toggle */}
        <div className="flex items-center bg-white border rounded-md p-0.5 shrink-0">
          <button
            onClick={() => setMobilePreview(false)}
            className={`p-1 rounded transition-colors ${!mobilePreview ? "bg-violet-100 text-violet-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMobilePreview(true)}
            className={`p-1 rounded transition-colors ${mobilePreview ? "bg-violet-100 text-violet-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0" onClick={() => { onRefresh(); setIframeLoading(true); }}>
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

      {/* iframe container */}
      <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-hidden relative">
        {!previewUrl ? (
          <div className="flex flex-col items-center justify-center text-center px-8">
            {loading ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                </div>
                <p className="text-sm font-medium text-gray-500 mb-1">Building your app...</p>
                <p className="text-xs text-gray-400">The preview will appear when the build finishes</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
                  <Monitor className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500 mb-1">No preview available</p>
                <p className="text-xs text-gray-400">Send a prompt to start building</p>
              </>
            )}
          </div>
        ) : (
          <div className={`bg-white shadow-lg transition-all duration-300 relative ${
            mobilePreview
              ? "w-[375px] h-[667px] rounded-[2rem] border-[8px] border-gray-800 overflow-hidden"
              : "w-full h-full"
          }`}>
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
              </div>
            )}
            <iframe
              src={fullIframeUrl || undefined}
              className="w-full h-full border-0"
              title="Project Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              onLoad={() => setIframeLoading(false)}
            />
          </div>
        )}
      </div>

      {/* Production URL footer */}
      {productionUrl && (
        <div className="px-3 py-1.5 border-t bg-gray-50/80 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Production</span>
          <a href={`https://${productionUrl}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-violet-600 hover:underline flex items-center gap-1">
            {productionUrl} <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}
    </div>
  );
}
