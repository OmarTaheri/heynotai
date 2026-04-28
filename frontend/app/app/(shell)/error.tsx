"use client";

import { useEffect } from "react";
import { Icon } from "@/components/Icon";

/**
 * Error boundary for /app/*. Catches anything thrown during render of a
 * dashboard page so the user sees a recoverable surface instead of a
 * blank screen.
 *
 * `reset` re-runs the segment that errored — handy for transient failures
 * like a flaky fetch. Logging belongs in a real reporter when wired up.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console for now; replace with your error reporter
    // (Sentry / OpenTelemetry / etc.) when one is wired up.
    console.error("[/app] render error:", error);
  }, [error]);

  return (
    <div className="empty-page" role="alert">
      <span className="empty-page-icon" aria-hidden>
        <Icon name="alert-triangle" size={24} />
      </span>
      <div className="empty-page-title">Something went wrong here.</div>
      <p className="empty-page-body">
        The page hit an unexpected error while rendering. Try again, or
        head back home if it keeps happening.
      </p>
      <div className="mt-4 flex gap-2">
        <button type="button" className="action-pill" onClick={reset}>
          Try again
        </button>
        <a href="/app" className="action-pill">
          Back home
        </a>
      </div>
    </div>
  );
}
