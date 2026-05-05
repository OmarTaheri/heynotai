import styles from "./StatusPill.module.css";

export type ScanState = "idle" | "scanning" | "done" | "failed";

interface Props {
  state: ScanState;
  label: string;
  onClick?: () => void;
}

export function StatusPill({ state, label, onClick }: Props) {
  // Failed scans share the "done" pill style for now — the editor's
  // detection panel surfaces the actual error message; this pill just
  // needs to stop reporting "scanning" when the run terminated.
  const className = state === "failed" ? styles.done : styles[state];
  return (
    <button type="button" className={`${styles.pill} ${className}`} onClick={onClick}>
      <span className={styles.dot} />
      <span>{label}</span>
    </button>
  );
}
