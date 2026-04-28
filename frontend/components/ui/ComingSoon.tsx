import type { ReactNode } from "react";
import styles from "./ComingSoon.module.css";

interface Props {
  /** Page content shown blurred behind the banner. */
  children: ReactNode;
  /** Optional name of the feature ("Monitors", "Reports", …). */
  feature?: string;
  /** Custom subtitle override. */
  subtitle?: string;
}

/**
 * Wraps a page in a blur + sticky "coming soon" banner. Used on app
 * surfaces whose UI is mocked but the underlying feature isn't built
 * yet — the user can still see what's coming without being able to
 * interact with the placeholder content.
 */
export function ComingSoon({ children, feature, subtitle }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.banner} aria-live="polite">
        <div className={styles.card}>
          <div className={styles.eyebrow}>
            <span className={styles.dot} />
            In development
          </div>
          <div className={styles.title}>
            {feature ? (
              <>
                {feature} <em>coming soon</em>
              </>
            ) : (
              <>
                Coming <em>soon</em>
              </>
            )}
          </div>
          {subtitle && <div className={styles.sub}>{subtitle}</div>}
        </div>
      </div>
      <div className={styles.overlay} aria-hidden />
      <div className={styles.content} aria-hidden>
        {children}
      </div>
    </div>
  );
}
