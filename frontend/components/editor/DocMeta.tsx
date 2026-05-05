import { Icon, type IconName } from "@/components/Icon";
import type { ScanState } from "@/components/editor-shell";
import { formatRelative } from "@/lib/library-data";
import type { ScanOrigin } from "@/lib/scan-types";
import styles from "./DocMeta.module.css";

interface Props {
  wordCount: number;
  /** ISO timestamp from the active engine's cached entry. Hidden when
   *  the selected engine has never been tested on this scan. */
  scannedAt?: string;
  scanState: ScanState;
  scanDurationMs?: number;
  origin?: ScanOrigin;
}

const STATUS_TEXT: Record<ScanState, string> = {
  idle: "Ready to scan",
  scanning: "Scanning · word-level",
  done: "Scan complete",
  failed: "Scan failed",
};

const ORIGIN_CHIP: Record<ScanOrigin, { label: string; icon: IconName }> = {
  paste: { label: "Pasted", icon: "paperclip" },
  upload: { label: "Uploaded", icon: "upload" },
  record: { label: "Recorded", icon: "mic" },
  link: { label: "From URL", icon: "link" },
  url: { label: "From URL", icon: "link" },
  ext: { label: "From extension", icon: "puzzle" },
  mon: { label: "From monitor", icon: "eye" },
};

export function DocMeta({
  wordCount,
  scannedAt,
  scanState,
  scanDurationMs,
  origin,
}: Props) {
  const status =
    scanState === "done" && scanDurationMs
      ? `Scan complete · ${(scanDurationMs / 1000).toFixed(1)}s`
      : STATUS_TEXT[scanState];

  const chip = origin ? ORIGIN_CHIP[origin] : ORIGIN_CHIP.upload;

  return (
    <div className={styles.meta}>
      <div className={styles.left}>
        <span className={styles.chip}>
          <Icon name={chip.icon} size={12} />
          {chip.label}
        </span>
        {scannedAt && <span>Scanned {formatRelative(scannedAt)}</span>}
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
