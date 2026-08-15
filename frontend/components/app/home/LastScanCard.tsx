import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TypeChip, type ScanType } from "@/components/ui/TypeChip";
import { Icon } from "@/components/Icon";

export type ScanVerdict = "ai" | "human";

export type ProseSegment = {
  text: string;
  /** When set, wraps the segment in a highlighted span. */
  highlight?: ScanVerdict;
};

export type SignalBar = {
  name: string;
  /** 0–100 — drives both the bar fill width and the value label. */
  value: number;
};

export type LastScan = {
  /** Backing scan id — the card's actions operate on this record. */
  id: string;
  type: ScanType;
  filename: string;
  meta: string;
  verdict: ScanVerdict;
  verdictLabel: string;
  score: number;
  closestModel: string;
  ci: string;
  prose: ProseSegment[][];
  signals: SignalBar[];
};

export type LastScanActions = {
  onOpen: () => void;
  onAddToCollection: () => void;
  onRescan: () => void;
  /** Disables the re-scan button while a rescan request is in flight. */
  rescanning?: boolean;
};

/**
 * "Last scan" detail card — title bar with type chip + verdict pill,
 * then a two-column body: prose excerpt with inline highlights on the
 * left, ring score + signal breakdown + recovery actions on the right.
 *
 * Composes ui/Card + ui/Pill + ui/ScoreRing + ui/ProgressBar +
 * ui/TypeChip + ui/Button — every primitive is reusable elsewhere.
 */
export function LastScanCard({
  scan,
  actions,
}: {
  scan: LastScan;
  actions: LastScanActions;
}) {
  const verdictTone = scan.verdict === "human" ? "human" : "ai";
  const ringTone = scan.verdict === "human" ? "human" : "ai";
  const labelClass =
    scan.verdict === "human"
      ? "home-score-label is-human"
      : "home-score-label";

  return (
    <Card as="article" elevated>
      <header className="home-detail-bar">
        <div className="home-detail-head">
          <TypeChip type={scan.type} />
          <div>
            <div className="home-detail-name">{scan.filename}</div>
            <div className="home-detail-meta">{scan.meta}</div>
          </div>
        </div>
        <Pill tone={verdictTone} dot>
          {scan.verdictLabel} · {scan.score}%
        </Pill>
      </header>

      <div className="home-detail-body">
        <div className="home-detail-content">
          <div className="home-tiny-lbl">
            Excerpt · highlights show AI-likely passages
          </div>
          <div className="home-prose">
            {scan.prose.map((paragraph, i) => (
              <p key={i}>
                {paragraph.map((seg, j) => {
                  if (seg.highlight === "ai") {
                    return (
                      <span key={j} className="home-hl-ai">
                        {seg.text}
                      </span>
                    );
                  }
                  if (seg.highlight === "human") {
                    return (
                      <span key={j} className="home-hl-human">
                        {seg.text}
                      </span>
                    );
                  }
                  return <span key={j}>{seg.text}</span>;
                })}
              </p>
            ))}
          </div>
        </div>

        <div className="home-detail-analysis">
          <div className="home-score">
            <ScoreRing score={scan.score} tone={ringTone} />
            <div className="home-score-meta">
              <div className={labelClass}>{scan.verdictLabel}</div>
              <div className="home-score-model">
                Closest match · <em>{scan.closestModel}</em>
              </div>
              <div className="home-score-ci">{scan.ci}</div>
            </div>
          </div>

          <div>
            <div className="home-tiny-lbl">Signal breakdown</div>
            <div className="home-bd">
              {scan.signals.map((sig) => (
                <ProgressBar
                  key={sig.name}
                  name={sig.name}
                  value={sig.value}
                  tone={ringTone}
                />
              ))}
            </div>
          </div>

          {/* Every action here hits a real endpoint. The card used to
              lead with "Export report", which had nothing behind it —
              report generation isn't built yet, so the primary action
              is now the one that always works: open the full scan. */}
          <div className="home-actions">
            <Button variant="primary" onClick={actions.onOpen}>
              <Icon name="file-text" size={12} />
              Open scan
            </Button>
            <Button onClick={actions.onAddToCollection}>
              <Icon name="folder" size={12} />
              Add to collection
            </Button>
            <Button onClick={actions.onRescan} disabled={actions.rescanning}>
              <Icon name="refresh" size={12} />
              {actions.rescanning ? "Re-scanning…" : "Re-scan"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
