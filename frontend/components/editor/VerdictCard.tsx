import { verdictFromScore } from "@/components/editor-shell";
import { ScoreRing, type RingTone } from "@/components/ui/ScoreRing";
import type { ScanResult, FlagKind } from "@/lib/detection-types";
import styles from "./VerdictCard.module.css";

const VERDICT_TONE: Record<"human" | "ai" | "mixed", RingTone> = {
  human: "human",
  ai: "ai",
  mixed: "mixed",
};

interface Props {
  result: ScanResult;
}

type VerdictKind = "human" | "ai" | "mixed";

// Above 90% / below 10% AI we drop the "Likely" hedge — the detector is
// unambiguous, so the soft language reads as weaker than the signal.
function pickVerdictCopy(
  verdict: VerdictKind,
  aiPct: number,
): { label: string | null; emph: string } {
  if (verdict === "ai") {
    return { label: aiPct >= 90 ? null : "Likely", emph: "AI-generated" };
  }
  if (verdict === "human") {
    return { label: aiPct <= 10 ? null : "Likely", emph: "human-written" };
  }
  return { label: "Mixed", emph: "signals" };
}

export function VerdictCard({ result }: Props) {
  const verdict = verdictFromScore(result.authenticity);
  const copy = pickVerdictCopy(verdict, result.aiPct);
  const flagCount = result.flags.length;

  // Today's HF detectors only emit a single AI-generated probability.
  // The card shows match/plag/burstiness/perplexity rows ONLY when the
  // underlying data is actually present — so per-model views collapse
  // to score-ring + AI-bar, and richer detectors (or legacy mock-era
  // records with a saved breakdown) light the extra rows back up.
  const matchPct = result.breakdown?.match;
  const plagPct = result.breakdown?.plag;
  const showMatch = typeof matchPct === "number" && matchPct > 0;
  const showPlag = typeof plagPct === "number" && plagPct > 0;
  const hasBurstiness = typeof result.burstiness === "number";
  const hasPerplexity = typeof result.perplexity === "number";
  const showStats = hasBurstiness || hasPerplexity;

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <span className={styles.ringWrap}>
          <ScoreRing
            score={result.aiPct}
            tone={VERDICT_TONE[verdict]}
            size={76}
            strokeWidth={5}
          />
        </span>
        <div>
          <div className={styles.head}>
            {copy.label && <>{copy.label} </>}
            <em>{copy.emph}</em>
          </div>
          <div className={styles.sub}>
            {flagCount} detection{flagCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <BarRow label="AI-generated" pct={result.aiPct} kind="gen" />
      {showMatch && <BarRow label="Model match" pct={matchPct!} kind="match" />}
      {showPlag && <BarRow label="Plagiarism" pct={plagPct!} kind="plag" />}

      {showStats && (
        <div className={styles.statRow}>
          {hasBurstiness && (
            <Stat
              value={result.burstiness!.toFixed(1)}
              suffix="/10"
              label="Burstiness"
            />
          )}
          {hasPerplexity && (
            <Stat value={result.perplexity!.toFixed(1)} label="Perplexity" />
          )}
        </div>
      )}
    </article>
  );
}

function BarRow({ label, pct, kind }: { label: string; pct: number; kind: FlagKind }) {
  const fillCls =
    kind === "gen" ? styles.barFillGen : kind === "match" ? styles.barFillMatch : styles.barFillPlag;
  return (
    <div className={styles.barRow}>
      <span className={styles.barLbl}>{label}</span>
      <span className={styles.barTrack}>
        <span className={`${styles.barFill} ${fillCls}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={styles.barPct}>{pct}%</span>
    </div>
  );
}

function Stat({ value, suffix, label }: { value: string; suffix?: string; label: string }) {
  return (
    <div>
      <div className={styles.statNum}>
        {value}
        {suffix && <span className={styles.statSuffix}>{suffix}</span>}
      </div>
      <div className={styles.statLbl}>{label}</div>
    </div>
  );
}
