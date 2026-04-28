import styles from "./StatusPulse.module.css";

type Tone = "ok" | "warn" | "ai" | "info";

/**
 * Pulsing colored dot — a live-status indicator. Mirrors the
 * extension popup's "extension live" pulse so the dashboard reads
 * the same affordance.
 *
 *   <StatusPulse tone="ok" />
 */
export function StatusPulse({ tone = "ok" }: { tone?: Tone }) {
  return <span className={`${styles.dot} ${styles[tone]}`} aria-hidden />;
}
