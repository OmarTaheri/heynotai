"use client";

import { useEffect } from "react";

/**
 * Catches render errors that escape every nested error boundary —
 * including failures inside the root layout itself (e.g. AuthProvider).
 * Replaces the root layout entirely, so it must render its own
 * <html> and <body>. No design-system tokens here: the stylesheet may
 * not be safe to load if the failure happened during layout init.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] render error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#0b0c0f",
          color: "#e8e8ea",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: 420,
            width: "100%",
            border: "1px solid #2a2c33",
            borderRadius: 18,
            padding: 28,
            textAlign: "center",
            background: "#13141a",
          }}
        >
          <p
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#8a8d99",
              margin: 0,
            }}
          >
            500
          </p>
          <h1
            style={{
              margin: "10px 0 6px",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Something broke at the root.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: "#b3b6c2",
            }}
          >
            The app hit an unrecoverable error. You can try again, or head
            back to the homepage.
          </p>
          <div
            style={{
              marginTop: 22,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                height: 40,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                color: "#fff",
                background: "#3b6cff",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                height: 40,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                border: "1px solid #2a2c33",
                fontWeight: 500,
                fontSize: 14,
                color: "#e8e8ea",
                textDecoration: "none",
              }}
            >
              Back to homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
