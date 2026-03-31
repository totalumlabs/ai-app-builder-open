"use client";

import { useEffect } from "react";

/**
 * Global Error Catcher - prevents Next.js error overlay and logs errors silently
 * Catches runtime errors and promise rejections without breaking UI
 */
export function GlobalErrorCatcher() {
  useEffect(() => {
    // Prevent Next.js error overlay using stopImmediatePropagation
    // This must run BEFORE Next.js attaches its listeners
    const handleError = (event: ErrorEvent) => {
      console.error("[Global Error Handler] Unhandled error:", event.error);
      console.error("[Global Error Handler] Message:", event.message);
      console.error("[Global Error Handler] Source:", event.filename, "Line:", event.lineno, "Col:", event.colno);

      // Stop Next.js overlay from showing
      event.stopImmediatePropagation();
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("[Global Error Handler] Unhandled promise rejection:", event.reason);

      // Stop Next.js overlay from showing
      event.stopImmediatePropagation();
    };

    // Add listeners with capture phase to run before Next.js
    window.addEventListener("error", handleError, true);
    window.addEventListener("unhandledrejection", handleRejection, true);

    return () => {
      window.removeEventListener("error", handleError, true);
      window.removeEventListener("unhandledrejection", handleRejection, true);
    };
  }, []);

  return null;
}
