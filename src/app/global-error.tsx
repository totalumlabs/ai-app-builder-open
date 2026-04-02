"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log critical global errors silently
    console.error("[Global Error Boundary] Critical global error:", error);
    console.error("[Global Error Boundary] Message:", error.message);
    console.error("[Global Error Boundary] Stack:", error.stack);
    if (error.digest) {
      console.error("[Global Error Boundary] Digest:", error.digest);
    }
  }, [error]);

  // Must include html and body tags as per Next.js docs
  // Show user-friendly error message for critical errors
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error - Application</title>
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(to bottom right, #f9fafb, #f3f4f6)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '90%',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          padding: '32px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: '#fee2e2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '32px'
          }}>
            ⚠️
          </div>

          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '12px'
          }}>
            Something went wrong
          </h1>

          <p style={{
            fontSize: '16px',
            color: '#6b7280',
            marginBottom: '24px',
            lineHeight: '1.5'
          }}>
            An error occurred. The error has been logged to the console. Please refresh the page to continue.
          </p>

          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#3b82f6',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background 0.2s',
              width: '100%'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#2563eb')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#3b82f6')}
          >
            Refresh Page
          </button>
        </div>
      </body>
    </html>
  );
}
