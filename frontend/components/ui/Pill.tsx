import type { ReactNode } from "react";
import styles from "./Pill.module.css";

export type PillTone =
  | "ai"
  | "human"
  | "mixed"
  | "info"
  | "warn"
  | "neutral"
  | "byok"
  | "local"
  | "gold";

/**
 * Compact label pill — verdict, status, or category badge.
 *
 *   <Pill tone="ai" dot>AI · 92%</Pill>
 *
 * `dot` adds the small leading colored disc (matches the extension's
 * verdict-pill pattern). `compact` shrinks padding for dense rows.
 */
export function Pill({
  children,
  tone = "neutral",
  dot,
  compact,
  className = "",
}: {
  children: ReactNode;
  tone?: PillTone;
  dot?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const classes = [
    styles.pill,
    styles[tone],
    compact && styles.compact,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes}>
      {dot && <span className={styles.dot} aria-hidden />}
      {children}
    </span>
  );
}
