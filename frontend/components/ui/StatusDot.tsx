import styles from "./StatusDot.module.css";

export type StatusTone = "ok" | "warn" | "alert" | "muted";

/**
 * Coloured live-state dot. `pulse` adds a slow expanding ring, used on
 * the page-level "monitors running" indicator and per-monitor active
 * status. `size="sm"` matches the inline pill dot footprint.
 */
export function StatusDot({
  tone = "ok",
  pulse,
  size,
  className = "",
}: {
  tone?: StatusTone;
  pulse?: boolean;
  size?: "sm";
  className?: string;
}) {
  const classes = [
    styles.dot,
    styles[tone],
    pulse && styles.pulse,
    size === "sm" && styles.sm,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={classes} aria-hidden />;
}
