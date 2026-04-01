"use client";

import { useState } from "react";
import { Monitor, Loader2 } from "lucide-react";

interface PreviewPanelProps {
  previewUrl: string | null;
  onRefresh: () => void;
  loading?: boolean;
  mobilePreview?: boolean;
  iframePath?: string;
}

export function PreviewPanel({ previewUrl, onRefresh, loading, mobilePreview = false, iframePath = "/" }: PreviewPanelProps) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const fullIframeUrl = previewUrl ? `${previewUrl}${iframePath === "/" ? "" : iframePath}` : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* iframe - no URL bar here, it's in the header now */}
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
