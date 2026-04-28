"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import styles from "./ComingSoon.module.css";

interface Props {
  /** Page content shown blurred behind the card. */
  children: ReactNode;
  /** Name of the feature ("Monitors", "Reports", "Team", "API"). */
  feature: string;
  /** Optional supporting line under the headline. */
  subtitle?: string;
}

/**
 * Wraps a page in a centered "coming soon" card with the brand's cream
 * surface + rainbow border, while the underlying page content renders
 * blurred behind a tinted scrim. Locks document scroll while mounted —
 * the page is a preview, not a working surface.
 */
export function ComingSoon({ children, feature, subtitle }: Props) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = prev;
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.content} aria-hidden>
        {children}
      </div>
      <div className={styles.scrim} aria-hidden />
      <div className={styles.center}>
        <div className={styles.card} role="status" aria-live="polite">
          <span className={styles.eyebrow}>
            <span className={styles.dot} />
            In development
          </span>
          <h2 className={styles.title}>
            {feature} <em>coming soon</em>
          </h2>
          {subtitle && <p className={styles.sub}>{subtitle}</p>}
          <Link href="/app" className={styles.cta}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
