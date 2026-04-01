"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ExternalLink, RefreshCw, Monitor, Smartphone, Loader2 } from "lucide-react";

interface PreviewPanelProps {
  previewUrl: string | null;
  onRefresh: () => void;
  loading?: boolean;
}

export function PreviewPanel({ previewUrl, onRefresh, loading }: PreviewPanelProps) {
  const [mobilePreview, setMobilePreview] = useState(false);
  const [iframePath, setIframePath] = useState("/");
  const [iframeLoading, setIframeLoading] = useState(true);

  const fullIframeUrl = previewUrl ? `${previewUrl}${iframePath === "/" ? "" : iframePath}` : null;

  return (
    <div className="h-full flex flex-col rounded-xl overflow-hidden">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f5f4f1]">
        <div className="flex gap-1 shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#e8e5df]" />
          <span className="w-2 h-2 rounded-full bg-[#e8e5df]" />
          <span className="w-2 h-2 rounded-full bg-[#e8e5df]" />
        </div>
        <div className="flex-1 min-w-0">
          <Input
            value={iframePath}
            onChange={(e) => setIframePath(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setIframeLoading(true); }}
            className="h-6 text-[11px] font-mono bg-white/80 border-0 rounded-md shadow-none focus-visible:ring-0"
            placeholder="/"
          />
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => setMobilePreview(false)} className={`p-1 rounded transition-colors ${!mobilePreview ? "text-gray-800" : "text-gray-400 hover:text-gray-600"}`}><Monitor className="w-3.5 h-3.5" /></button>
          <button onClick={() => setMobilePreview(true)} className={`p-1 rounded transition-colors ${mobilePreview ? "text-gray-800" : "text-gray-400 hover:text-gray-600"}`}><Smartphone className="w-3.5 h-3.5" /></button>
          <button className="p-1 rounded text-gray-400 hover:text-gray-600" onClick={() => { onRefresh(); setIframeLoading(true); }}><RefreshCw className="w-3.5 h-3.5" /></button>
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-gray-400 hover:text-gray-600"><ExternalLink className="w-3.5 h-3.5" /></a>
          )}
        </div>
      </div>

      {/* iframe */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative" style={{ background: "#fcfbf8" }}>
        {!previewUrl ? (
          <div className="flex flex-col items-center justify-center text-center px-8">
            {loading ? (
              <>
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-4" />
                <p className="text-sm font-medium text-gray-500 mb-1">Building your app...</p>
                <p className="text-xs text-gray-400">Preview will appear when ready</p>
              </>
            ) : (
              <>
                <Monitor className="w-10 h-10 text-gray-300 mb-4" />
                <p className="text-sm font-medium text-gray-500 mb-1">No preview yet</p>
                <p className="text-xs text-gray-400">Send a prompt to start building</p>
              </>
            )}
          </div>
        ) : (
          <div className={`bg-white transition-all duration-300 relative ${
            mobilePreview ? "w-[375px] h-[667px] rounded-[2rem] border-[8px] border-gray-800 overflow-hidden shadow-2xl" : "w-full h-full"
          }`}>
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            )}
            <iframe src={fullIframeUrl || undefined} className="w-full h-full border-0" title="Preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" onLoad={() => setIframeLoading(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
