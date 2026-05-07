export function ComingSoonOverlay() {
  return (
    <>
      <div className="coming-soon-scrim" aria-hidden />
      <div className="coming-soon-center">
        <div className="coming-soon-card" role="status" aria-live="polite">
          <span className="coming-soon-eyebrow">
            <span className="coming-soon-dot" />
            In development
          </span>
          <h2 className="coming-soon-title">
            Stats <em>coming soon</em>
          </h2>
          <p className="coming-soon-sub">
            Detailed analytics for your scans are landing soon.
          </p>
        </div>
      </div>
    </>
  );
}
