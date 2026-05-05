"use client";

import type { ScanState } from "@/components/editor-shell";
import type { ScanVerdict } from "@/lib/scan-types";
import styles from "./YouTubeCanvas.module.css";

interface Props {
  videoId: string | null;
  // Kept on the props so the editor client can keep passing them; the
  // canvas itself doesn't render a verdict banner anymore (the
  // DetectionPanel sidebar already shows the same data, and the banner
  // duplicated it without adding value). If we want a banner back
  // later, we'll have these on hand.
  scanState?: ScanState;
  verdict?: ScanVerdict | null;
  aiPct?: number | null;
}

export function YouTubeCanvas({ videoId }: Props) {
  return (
    <div className={styles.shell}>
      <div className={styles.player}>
        {videoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className={styles.empty}>No video URL</div>
        )}
      </div>
    </div>
  );
}
