"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();

  const aiPrompt = `There is an error on page "${pathname}", check logs and solve it.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  useEffect(() => {
    // Log error to console with full details
    console.error("[Error Boundary] Error caught:", error);
    console.error("[Error Boundary] Message:", error.message);
    console.error("[Error Boundary] Stack:", error.stack);
    if (error.digest) {
      console.error("[Error Boundary] Digest:", error.digest);
    }
  }, [error]);

  return (
    <div className="flex min-h-[400px] w-full items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900 dark:bg-red-950/30">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
            <svg
              className="h-5 w-5 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
              Something went wrong
            </h2>
            <p className="text-sm text-red-600 dark:text-red-400">
              An error occurred in this section
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-md bg-red-100/50 p-3 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            Error: {error.message || "Unknown error"}
          </p>
        </div>

        {/* AI Help Section */}
        <div className="mb-4 rounded-lg border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-700 dark:from-blue-950/50 dark:to-indigo-950/50">
          <div className="mb-2 flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-base font-bold text-blue-800 dark:text-blue-200">
              Let AI fix this
            </span>
          </div>
          <p className="mb-3 text-sm text-blue-700 dark:text-blue-300">
            Copy this and paste it in the AI chat:
          </p>
          <div className="relative">
            <div className="rounded-md border border-blue-200 bg-white p-3 pr-12 font-mono text-sm text-gray-800 dark:border-blue-800 dark:bg-gray-900 dark:text-gray-200">
              {aiPrompt}
            </div>
            <button
              onClick={handleCopy}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-blue-600 p-2 text-white transition-all hover:bg-blue-700 active:scale-95"
              title="Copy to clipboard"
            >
              {copied ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
          {copied && (
            <p className="mt-2 text-center text-sm font-medium text-green-600 dark:text-green-400">
              Copied!
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => reset()}
            className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Try again
          </button>
          <button
            onClick={() => window.history.back()}
            className="w-full rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-red-800 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-900/30"
          >
            Go back
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-red-800 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-900/30"
          >
            {showDetails ? "Hide details" : "Show details"}
          </button>
        </div>

        {showDetails && (
          <div className="mt-4 rounded-md bg-gray-900 p-3">
            <pre className="max-h-48 overflow-auto text-xs text-gray-300">
              {error.stack || "No stack trace available"}
            </pre>
            {error.digest && (
              <p className="mt-2 text-xs text-gray-500">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
