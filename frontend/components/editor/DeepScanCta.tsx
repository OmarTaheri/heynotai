import { Icon } from "@/components/Icon";
import styles from "./DeepScanCta.module.css";

interface Props {
  onClick: () => void;
  /** True while a plagiarism scan is in flight — the CTA stays static
   *  and non-interactive (no shimmer, no hover) and shows a working
   *  status line instead of the cost line. */
  scanning?: boolean;
  /** Feature isn't built yet — render the CTA as a locked preview that
   *  can't be triggered. Takes precedence over `scanning`. */
  locked?: boolean;
}

export function DeepScanCta({ onClick, scanning = false, locked = false }: Props) {
  const inert = locked || scanning;
  return (
    <button
      type="button"
      className={`${styles.cta}${scanning ? ` ${styles.scanning}` : ""}${locked ? ` ${styles.locked}` : ""}`}
      onClick={onClick}
      disabled={inert}
      aria-busy={scanning}
      aria-disabled={locked || undefined}
      title={locked ? "Plagiarism deep scan — coming soon" : undefined}
    >
      <span className={styles.icon}>
        <Icon name={locked ? "lock" : "search"} size={18} />
      </span>
      <span className={styles.body}>
        <span className={styles.title}>
          {scanning ? (
            <>Running <em>plagiarism deep scan</em>…</>
          ) : (
            <>Run <em>plagiarism deep scan</em></>
          )}
        </span>
        <span className={styles.sub}>
          {locked
            ? "Coming soon · Web + academic"
            : scanning
              ? "Querying web + academic indexes"
              : "Web + academic · 12 tokens · Pro plan"}
        </span>
      </span>
      <span className={styles.arrow}>
        <Icon name={locked ? "lock" : "chevron-right"} size={locked ? 14 : 16} />
      </span>
    </button>
  );
}
