"use client";

import { useEffect, useState } from "react";

/**
 * Brand loader — the visual cold-open every time the app boots.
 *
 * Renders just the "ai" letters at splash size, then triggers the same
 * `.logo-word.is-closed` state the header logo uses — so the hand-drawn
 * strike in globals.css (logo-strike-draw keyframes) plays across "ai"
 * exactly like the nav logo, without the "hey" / "not" wordmark around it.
 *
 *   0       → "ai" visible
 *   ~220ms  → strike draws across (0.26s, scoped faster variant)
 *   ~1.05s  → stage fades out over 0.55s — slow enough that the
 *             dashboard underneath feels revealed rather than cut to.
 *   ~1.6s   → loader unmounts.
 */
export function BrandLoader({
  onDone,
  durationMs = 1600,
}: {
  onDone?: () => void;
  durationMs?: number;
}) {
  const [visible, setVisible] = useState(true);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const strike = window.setTimeout(() => setClosed(true), 220);
    const done = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, durationMs);
    return () => {
      window.clearTimeout(strike);
      window.clearTimeout(done);
    };
  }, [durationMs, onDone]);

  if (!visible) return null;

  return (
    <div className="brand-loader" role="status" aria-live="polite" aria-label="Loading">
      <span
        className={`logo-word${closed ? " is-closed" : ""}`}
        aria-label="ai"
        style={{ fontSize: "72px" }}
      >
        <span className="logo-ai">
          <span className="logo-strike" aria-hidden />
          ai
        </span>
      </span>
    </div>
  );
}
