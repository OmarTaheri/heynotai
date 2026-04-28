import styles from "./Sparkline.module.css";

export type SparkBar = { height: number; flagged?: boolean };

/**
 * Bar-style activity strip — one bar per period, with a `flagged`
 * variant that swaps to the strike colour. Heights are passed in 0–100
 * (percent of the track) so callers don't need to know the rendered
 * height.
 *
 *   <Sparkline label="Activity" range="7 days" bars={…} foot={["17 Apr","TODAY"]} />
 */
export function Sparkline({
  bars,
  label,
  range,
  foot,
}: {
  bars: SparkBar[];
  label?: string;
  range?: string;
  foot?: [string, string];
}) {
  return (
    <div className={styles.spark}>
      {(label || range) && (
        <div className={styles.head}>
          {label && <span className={styles.label}>{label}</span>}
          {range && <span className={styles.range}>{range}</span>}
        </div>
      )}
      <div className={styles.bars} aria-hidden>
        {bars.map((b, i) => (
          <span
            key={i}
            className={b.flagged ? `${styles.bar} ${styles.flagged}` : styles.bar}
            style={{ height: `${Math.max(2, Math.min(100, b.height))}%` }}
          />
        ))}
      </div>
      {foot && (
        <div className={styles.foot}>
          <span>{foot[0]}</span>
          <span>{foot[1]}</span>
        </div>
      )}
    </div>
  );
}
