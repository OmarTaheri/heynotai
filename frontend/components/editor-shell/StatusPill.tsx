import styles from "./StatusPill.module.css";

export type ScanState = "idle" | "scanning" | "done";

interface Props {
  state: ScanState;
  label: string;
  onClick?: () => void;
}

export function StatusPill({ state, label, onClick }: Props) {
  return (
    <button type="button" className={`${styles.pill} ${styles[state]}`} onClick={onClick}>
      <span className={styles.dot} />
      <span>{label}</span>
    </button>
  );
}
