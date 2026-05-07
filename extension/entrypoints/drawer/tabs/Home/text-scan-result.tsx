import { RingScore } from '@/components/RingScore';
import type { Scan } from '@/lib/scans-api';
import {
  detectionsCount,
  openEditor,
  relativeTime,
  verdictFromScan,
  verdictHeadline,
} from './helpers';

/** Primary text-scan result card — replaces the "Website detected /
 *  Run a check / Add to allow-list" idle UI when the user has just
 *  triggered a right-click text scan. Dismissing it (× button) restores
 *  the original idle UI for the current scan id. */
export function TextScanResultView({
  scan,
  onDismiss,
}: {
  scan: Scan;
  onDismiss: () => void;
}) {
  const verdict = verdictFromScan(scan);
  const aiPct = Math.max(0, Math.min(100, Math.round(scan.aiPct)));
  const detections = detectionsCount(scan);
  const headline = verdictHeadline(scan);
  const when = relativeTime(scan.created);
  const text = (scan.content ?? '').trim();
  return (
    <section className={`card text-result-card verdict-${verdict}`}>
      <button
        type="button"
        className="text-result-close"
        aria-label="Dismiss text scan result"
        title="Dismiss"
        onClick={onDismiss}
      >
        <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor"
                strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      </button>
      <div className="text-result-head">
        <RingScore score={aiPct} verdict={verdict} size={84} />
        <div className="text-result-copy">
          <div className="text-result-headline">{headline}</div>
          <div className="text-result-meta mono">
            {detections.toLocaleString()} detection{detections === 1 ? '' : 's'}
          </div>
          <div className="text-result-when mono">{when}</div>
        </div>
      </div>
      <div className="text-result-bar-row">
        <span className="text-result-bar-label">AI-generated</span>
        <div className="text-result-bar" aria-hidden="true">
          <div
            className={`text-result-bar-fill verdict-${verdict}`}
            style={{ width: `${aiPct}%` }}
          />
        </div>
        <span className="text-result-bar-pct mono">{aiPct}%</span>
      </div>
      {text ? (
        <div className="text-result-excerpt-block">
          <div className="text-result-excerpt-label">Scanned text</div>
          <div className="text-result-excerpt">{text}</div>
        </div>
      ) : null}
      <button
        type="button"
        className="text-result-cta"
        onClick={() => openEditor(scan.id)}
      >
        Open in editor
        <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
          <path d="M6 3h7v7M13 3l-9 9" stroke="currentColor"
                strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  );
}
