import { ScoreRing, verdictFromScore } from "@/components/editor-shell";
import type { ScanResult, FlagKind } from "@/lib/detection-types";
import styles from "./VerdictCard.module.css";

interface Props {
  result: ScanResult;
  burstiness?: number;
  perplexity?: number;
  aiRate?: number;
}

const VERDICT_COPY = {
  human: { label: "Likely", emph: "human-written" },
  ai: { label: "Likely", emph: "AI-generated" },
  mixed: { label: "Mixed", emph: "signals" },
} as const;

export function VerdictCard({
  result,
  burstiness = 3.2,
  perplexity = 22.4,
  aiRate,
}: Props) {
  const verdict = verdictFromScore(result.authenticity);
  const copy = VERDICT_COPY[verdict];
  const flagCount = result.flags.length;
  const aiPct = aiRate ?? 100 - result.authenticity;

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <ScoreRing
          value={result.authenticity}
          size={54}
          stroke={4}
          verdict={verdict}
          trackColor="rgba(26,25,22,0.1)"
          numClassName={styles.ringNum}
        />
        <div>
          <div className={styles.head}>
            {copy.label} <em>{copy.emph}</em>
          </div>
          <div className={styles.sub}>
            {flagCount} detection{flagCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <BarRow label="AI-generated" pct={result.breakdown.gen} kind="gen" />
      <BarRow label="Model match" pct={result.breakdown.match} kind="match" />
      <BarRow label="Plagiarism" pct={result.breakdown.plag} kind="plag" />

      <div className={styles.statRow}>
        <Stat value={burstiness.toFixed(1)} suffix="/10" label="Burstiness" />
        <Stat value={perplexity.toFixed(1)} label="Perplexity" />
        <Stat value={Math.round(aiPct).toString()} suffix="%" label="AI rate" />
      </div>
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
