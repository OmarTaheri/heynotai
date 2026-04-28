import { Icon } from "@/components/Icon";
import type { ScanState } from "@/components/editor-shell";
import styles from "./DocMeta.module.css";

interface Props {
  filename: string;
  wordCount: number;
  scannedAgo?: string;
  scanState: ScanState;
  scanDurationMs?: number;
}

const STATUS_TEXT: Record<ScanState, string> = {
  idle: "Ready to scan",
  scanning: "Scanning · word-level",
  done: "Scan complete",
};

export function DocMeta({
  filename,
  wordCount,
  scannedAgo = "4m ago",
  scanState,
  scanDurationMs,
}: Props) {
  const status =
    scanState === "done" && scanDurationMs
      ? `Scan complete · ${(scanDurationMs / 1000).toFixed(1)}s`
      : STATUS_TEXT[scanState];

  return (
    <div className={styles.meta}>
      <div className={styles.left}>
        <span className={styles.chip}>
          <Icon name="upload" size={12} />
          Uploaded
        </span>
        <span>{filename}</span>
        <span>Scanned {scannedAgo}</span>
        <span>
          {wordCount} word{wordCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className={`${styles.status} ${styles[scanState]}`}>
        <span className={styles.dot} />
        <span>{status}</span>
      </div>
    </div>
  );
}
