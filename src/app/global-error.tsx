"use client";

import { useEffect } from "react";

/**
 * The last resort: an error thrown by the root layout itself.
 *
 * This one replaces the layout rather than rendering inside it, so there is no
 * stylesheet, no font and no shell -- `globals.css` is imported by the layout
 * that just failed. Every colour here is therefore written out by hand from
 * the same tokens, and nothing is imported from the app but React.
 *
 * It is deliberately the plainest page in the product. Anything clever here
 * can throw, and an error boundary that throws shows the browser's own error
 * instead, which is the one outcome this file exists to prevent.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] root layout failed", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "40px 16px",
          background: "#0b0812",
          color: "#f4f1fa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main style={{ width: "100%", maxWidth: "46ch", textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 28px",
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            GTA <span style={{ color: "#ff2d78" }}>6</span>{" "}
            <span style={{ color: "#a89fc2", fontWeight: 500 }}>MONEY LAB</span>
          </p>

          <div
            style={{
              background: "#0e0b16",
              border: "1px solid #241d36",
              borderRadius: 16,
              padding: 32,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 19,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              The site failed to load
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: "40ch",
                fontSize: 13,
                lineHeight: 1.65,
                color: "#a89fc2",
              }}
            >
              This is a failure in the page shell itself rather than in anything
              you did. Your account and your saved work are not affected.
            </p>

            <button
              onClick={reset}
              style={{
                marginTop: 26,
                height: 34,
                padding: "0 18px",
                borderRadius: 999,
                border: "none",
                background: "#ff2d78",
                color: "#fff",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>

          {error.digest ? (
            <p style={{ marginTop: 20, fontSize: 12, color: "#6f6791" }}>
              Include this if you report it:{" "}
              <code style={{ fontFamily: "ui-monospace, monospace", color: "#a89fc2" }}>
                {error.digest}
              </code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
