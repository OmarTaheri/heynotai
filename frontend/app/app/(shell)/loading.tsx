/**
 * Suspense fallback for /app/* navigations.
 *
 * Triggered automatically by Next.js whenever a server component in this
 * segment is awaiting data. Static pages (most of the dashboard right
 * now) skip this and render directly. As pages grow async fetches, this
 * placeholder shows a quiet centered pulse so the layout doesn't flash
 * an empty pane.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span
        className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-fg-mid)]"
        aria-hidden
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
