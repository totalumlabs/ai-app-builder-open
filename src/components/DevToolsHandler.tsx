"use client";

import { useEffect } from "react";
import { consoleLogger } from "@/lib/console-logger";

/**
 * DevToolsHandler - Initializes console logger to forward logs to parent
 * This component initializes the console logger on mount to capture all logs in real-time
 * No longer uses Eruda - logs are displayed in parent window's unified logs modal
 */
export function DevToolsHandler() {
  useEffect(() => {
    // Initialize console logger on mount
    consoleLogger.init();

    // Cleanup on unmount
    return () => {
      consoleLogger.cleanup();
    };
  }, []);

  // This component doesn't render anything visible
  return null;
}
