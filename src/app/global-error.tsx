"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error — RyanFenn.ai</title>
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        background: "#05080D",
        color: "#FFFFFF",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          maxWidth: "500px",
          width: "90%",
          background: "#0E1925",
          border: "1px solid rgba(0, 223, 255, 0.22)",
          boxShadow: "0 0 40px rgba(0, 223, 255, 0.12)",
          padding: "32px",
          textAlign: "center"
        }}>
          <div style={{
            width: "56px",
            height: "56px",
            background: "#05080D",
            border: "1px solid rgba(255, 77, 109, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: "22px"
          }}>
            !
          </div>

          <h1 style={{
            fontSize: "24px",
            fontWeight: "700",
            color: "#FFFFFF",
            marginBottom: "12px",
            letterSpacing: "0.04em"
          }}>
            Something went wrong
          </h1>

          <p style={{
            fontSize: "16px",
            color: "#94A3B8",
            marginBottom: "24px",
            lineHeight: "1.5"
          }}>
            An error occurred. Refresh the page to continue.
          </p>

          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#00DFFF",
              color: "#05080D",
              padding: "12px 24px",
              borderRadius: "2px",
              border: "none",
              fontSize: "14px",
              fontWeight: "600",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
              width: "100%"
            }}
          >
            Refresh Page
          </button>
        </div>
      </body>
    </html>
  );
}
