import styles from "./ScoreRing.module.css";

export type Verdict = "human" | "ai" | "mixed";

const COLOR_FOR_VERDICT: Record<Verdict, string> = {
  human: "var(--color-human)",
  ai: "var(--color-ai)",
  mixed: "var(--color-mixed)",
};

interface Props {
  value: number;
  size?: number;
  stroke?: number;
  verdict?: Verdict;
  showNumber?: boolean;
  trackColor?: string;
  numClassName?: string;
}

export function ScoreRing({
  value,
  size = 32,
  stroke = 3,
  verdict = "ai",
  showNumber = true,
  trackColor = "rgba(255, 255, 255, 0.08)",
  numClassName,
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const offset = c * (1 - safe / 100);

  return (
    <span className={styles.ring} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
          className={styles.ringTrack}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLOR_FOR_VERDICT[verdict]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={styles.ringFg}
        />
      </svg>
      {showNumber && (
        <span className={`${styles.num}${numClassName ? ` ${numClassName}` : ""}`}>
          {safe}
        </span>
      )}
    </span>
  );
}

export function verdictFromScore(score: number): Verdict {
  if (score >= 75) return "human";
  if (score >= 45) return "mixed";
  return "ai";
}
