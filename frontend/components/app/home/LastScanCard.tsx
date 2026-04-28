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

/**
 * "Last scan" detail card — title bar with type chip + verdict pill,
 * then a two-column body: prose excerpt with inline highlights on the
 * left, ring score + signal breakdown + recovery actions on the right.
 *
 * Composes ui/Card + ui/Pill + ui/ScoreRing + ui/ProgressBar +
 * ui/TypeChip + ui/Button — every primitive is reusable elsewhere.
 */
export function LastScanCard({ scan }: { scan: LastScan }) {
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

          <div className="home-actions">
            <Button variant="primary">
              <Icon name="file-text" size={12} />
              Export report
            </Button>
            <Button>
              <Icon name="folder" size={12} />
              Add to collection
            </Button>
            <Button>
              <Icon name="refresh" size={12} />
              Re-scan
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
