import styles from "./Toggle.module.css";

/**
 * Accessible on/off switch. Controlled — owner manages the boolean.
 *
 *   <Toggle on={enabled} onChange={setEnabled} label="Notify me" />
 *
 * Sized via `size`: "md" for standalone form rows, "sm" for dense
 * tables (e.g. the Notifications matrix).
 */
export function Toggle({
  on,
  onChange,
  label,
  size = "md",
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const classes = [styles.toggle, styles[size], on ? styles.on : styles.off]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={classes}
      onClick={() => onChange(!on)}
    >
      <span className={styles.knob} />
    </button>
  );
}
