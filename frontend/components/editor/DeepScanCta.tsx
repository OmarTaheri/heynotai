import { Icon } from "@/components/Icon";
import styles from "./DeepScanCta.module.css";

export function DeepScanCta() {
  return (
    <button type="button" className={styles.cta}>
      <span className={styles.icon}>
        <Icon name="search" size={18} />
      </span>
      <span className={styles.body}>
        <span className={styles.title}>
          Run <em>plagiarism deep scan</em>
        </span>
        <span className={styles.sub}>Web + academic · 12 tokens · Pro plan</span>
      </span>
      <span className={styles.arrow}>
        <Icon name="chevron-right" size={16} />
      </span>
    </button>
  );
}
