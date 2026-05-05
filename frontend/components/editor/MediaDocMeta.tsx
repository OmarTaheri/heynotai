import { Icon } from "@/components/Icon";
import type { ScanState } from "@/components/editor-shell";
import { formatRelative } from "@/lib/library-data";
import styles from "./DocMeta.module.css";

interface Props {
  /** Right-of-chip facts, e.g. "1920×1080 · jpg" or "00:08 · stereo". */
  stats: string;
  /** ISO timestamp from the active engine's cached entry. Hidden when
   *  the selected engine has never been tested on this scan. */
  scannedAt?: string;
  scanState: ScanState;
  scanDurationMs?: number;
  /** Override the upload chip label (e.g. "Image", "Video", "Audio"). */
  chipLabel?: string;
}

const STATUS_TEXT: Record<ScanState, string> = {
  idle: "Ready to scan",
  scanning: "Scanning",
  done: "Scan complete",
  failed: "Scan failed",
};

export function MediaDocMeta({
  stats,
  scannedAt,
  scanState,
  scanDurationMs,
  chipLabel = "Uploaded",
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
          {chipLabel}
        </span>
        {scannedAt && <span>Scanned {formatRelative(scannedAt)}</span>}
        <span>{stats}</span>
      </div>
      <div className={`${styles.status} ${styles[scanState]}`}>
        <span className={styles.dot} />
        <span>{status}</span>
      </div>
    </div>
  );
}
