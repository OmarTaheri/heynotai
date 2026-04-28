import styles from "./ProgressBar.module.css";

export type ProgressTone = "neutral" | "ai" | "human" | "mixed" | "info";

/**
 * Single-row labeled progress bar.
 *
 *   <ProgressBar name="Perplexity" value={92} />
 *
 * `value` is 0–100. `tone` colors the fill so signal breakdowns can
 * encode the verdict alongside the magnitude.
 */
export function ProgressBar({
  name,
  value,
  tone = "neutral",
}: {
  name: string;
  value: number;
  tone?: ProgressTone;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const fillClass = [styles.fill, tone !== "neutral" && styles[tone]]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={styles.row}>
      <span className={styles.name}>{name}</span>
      <div className={styles.track}>
        <div className={fillClass} style={{ width: `${clamped}%` }} />
      </div>
      <span className={styles.value}>{Math.round(clamped)}</span>
    </div>
  );
}
