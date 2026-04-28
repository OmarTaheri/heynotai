import type { ReactNode } from "react";
import styles from "./FormRow.module.css";

/**
 * Standard label + control + optional aux row used across every
 * settings card. Three-column grid on wide screens, stacked on
 * mobile. Pass `stacked` to force the single-column layout (useful
 * for full-width inputs like a textarea).
 */
export function FormRow({
  label,
  hint,
  control,
  aux,
  stacked,
}: {
  label: string;
  hint?: string;
  control?: ReactNode;
  aux?: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={`${styles.row} ${stacked ? styles.stacked : ""}`.trim()}
    >
      <div className={styles.label}>
        <span>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      {control !== undefined && <div className={styles.control}>{control}</div>}
      {aux !== undefined && <div className={styles.aux}>{aux}</div>}
    </div>
  );
}
