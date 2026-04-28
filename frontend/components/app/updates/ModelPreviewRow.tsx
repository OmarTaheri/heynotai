import type { ModelPreview } from "@/lib/updates-data";
import styles from "./ModelPreviewRow.module.css";

/**
 * Inline model card embedded inside an `UpdateCard`. Shows the vendor
 * logo tile, model name + meta line, and the accuracy figure.
 */
export function ModelPreviewRow({ preview }: { preview: ModelPreview }) {
  return (
    <div className={styles.row}>
      <div className={styles.logo} data-vendor={preview.vendor}>
        {preview.initials}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{preview.name}</div>
        <div className={styles.meta}>{preview.metaLine}</div>
      </div>
      <div className={styles.acc}>
        <div
          className={styles.accVal}
          data-warn={preview.warn ? "true" : undefined}
        >
          {preview.accuracy}
          <em>%</em>
        </div>
        <div className={styles.accLbl}>Accuracy</div>
      </div>
    </div>
  );
}
