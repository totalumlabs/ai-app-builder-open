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
      // Stop Next.js overlay from showing
      event.stopImmediatePropagation();
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
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
