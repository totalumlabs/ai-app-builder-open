"use client";

import { useState } from "react";
import type { RefObject } from "react";
import { Monitor, Loader2, Archive } from "lucide-react";

interface PreviewPanelProps {
  previewUrl: string | null;
  onRefresh: () => void;
  loading?: boolean;
  mobilePreview?: boolean;
  iframePath?: string;
  cached?: boolean;
  /**
   * ═══⭐⭐ THE SAME-ORIGIN PREVIEW, AND WHY IT EXISTS ═══════════════════════
   *
   * ⚠️ THE VISUAL EDITOR CANNOT WORK ON A CROSS-ORIGIN FRAME. It selects elements,
   * reads computed styles and applies live text edits by SCRIPTING the previewed
   * document, and the browser forbids all of that across origins — no amount of
   * `sandbox` flags changes it. `/api/preview/{projectId}` re-serves the project
   * through this app, so the document becomes same-origin and scriptable.
   *
   * ⚠️ IT IS USED ONLY WHILE THE EDITOR IS OPEN. Normal viewing keeps the direct
   * URL: the proxy costs a round trip per asset and rewrites the HTML, and neither
   * is worth paying for a preview nobody is editing.
   */
  proxiedSrc?: string | null;
  /** The editor needs the element to `postMessage` to its injected agent. */
  frameRef?: RefObject<HTMLIFrameElement | null>;
}

export function PreviewPanel({ previewUrl, onRefresh, loading, mobilePreview = false, iframePath = "/", cached = false, proxiedSrc, frameRef }: PreviewPanelProps) {
  const [iframeLoading, setIframeLoading] = useState(true);
  /** ⚠️ The proxy wins when present — see `proxiedSrc`. */
  const base = (proxiedSrc || previewUrl || "").replace(/\/$/, "");
  const fullIframeUrl = base ? `${base}${iframePath === "/" ? "" : iframePath}` : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* iframe - no URL bar here, it's in the header now */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative" style={{ background: "#fcfbf8" }}>
        {/* Cached snapshot indicator: shown when the dev server is not active and
            we're displaying the cachedDevelopmentUrl static snapshot */}
        {previewUrl && cached && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm">
            <Archive className="w-3 h-3" />
            <span>Cached snapshot · server sleeping</span>
          </div>
        )}
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
            <iframe
              /* ⚠️ REMOUNT WHEN THE ORIGIN CHANGES. Swapping the `src` between the direct
                 URL and the proxy without a new element leaves the old document (and its
                 injected agent, or lack of one) in place. */
              key={proxiedSrc ? "proxy" : "direct"}
              ref={frameRef}
              src={fullIframeUrl || undefined}
              className="w-full h-full border-0"
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              onLoad={() => setIframeLoading(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
