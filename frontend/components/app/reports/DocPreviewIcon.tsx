import type { ReportBand } from "@/lib/reports-data";
import styles from "./DocPreviewIcon.module.css";

/**
 * Mini "page" thumbnail used as the row icon in the reports table.
 * Renders a stack of placeholder text lines with optional colored
 * verdict bands woven through. Tints come from --color-{ai,human,mixed}-soft
 * so the dark-mode palette flows through without inventing new colors.
 */
export function DocPreviewIcon({
  bands = [],
  dim,
}: {
  bands?: ReportBand[];
  dim?: boolean;
}) {
  // Layout pattern: 6 line-rows where bands are interleaved between
  // text lines. We keep the line widths slightly varied so the icon
  // reads as a real document and not a barcode.
  type Slot = "med" | "short" | ReportBand;
  const slots: Slot[] = ["med", "short", "med", "short", "med", "short"];
  if (bands.length > 0) {
    // Insert bands at positions 3 and 5 so they sit roughly in the
    // middle and bottom — same composition as the HTML mockup.
    const positions = [2, 4];
    bands.forEach((band, i) => {
      const pos = positions[i % positions.length];
      slots.splice(pos, 0, band);
    });
  }

  return (
    <div className={`${styles.icon} ${dim ? styles.dim : ""}`} aria-hidden>
      {slots.slice(0, 6).map((slot, i) => {
        if (slot === "ai" || slot === "human" || slot === "mixed") {
          return <div key={i} className={`${styles.band} ${styles[slot]}`} />;
        }
        return <div key={i} className={`${styles.line} ${styles[slot]}`} />;
      })}
    </div>
  );
}
