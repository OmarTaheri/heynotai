"use client";

import { useState } from "react";
import type { ScanState } from "@/components/editor-shell";
import type { ScanVerdict } from "@/lib/scan-types";
import styles from "./YouTubeCanvas.module.css";

interface Props {
  videoId: string | null;
  scanState: ScanState;
  verdict: ScanVerdict | null;
  aiPct: number | null;
}

export function YouTubeCanvas({ videoId, scanState, verdict, aiPct }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const banner = bannerCopy(scanState, verdict, aiPct);

  return (
    <div className={styles.shell}>
      <div
        className={`${styles.banner} ${collapsed ? styles.collapsed : ""}`}
        data-state={banner.dataState}
      >
        <div className={styles.icon} aria-hidden>
          {banner.icon}
        </div>
        <div className={styles.copy}>
          <div className={styles.title}>{banner.title}</div>
          <div className={styles.subtitle}>{banner.subtitle}</div>
        </div>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand verdict" : "Collapse verdict"}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? (
              <path d="M4 6l4 4 4-4" />
            ) : (
              <path d="M4 10l4-4 4 4" />
            )}
          </svg>
        </button>
        {scanState === "scanning" && <div className={styles.scanBar} aria-hidden />}
      </div>

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

function bannerCopy(
  scanState: ScanState,
  verdict: ScanVerdict | null,
  aiPct: number | null,
): { dataState: string; icon: React.ReactNode; title: string; subtitle: string } {
  if (scanState === "scanning") {
    return {
      dataState: "scanning",
      icon: scanningIcon(),
      title: "Analyzing video…",
      subtitle: "Downloading and inspecting frames for AI generation cues.",
    };
  }
  if (scanState === "failed") {
    return {
      dataState: "failed",
      icon: alertIcon(),
      title: "Scan unavailable",
      subtitle: "We could not analyze this video. Try a different model or rescan.",
    };
  }
  // done
  const pct = aiPct == null ? null : Math.round(aiPct);
  if (verdict === "human") {
    return {
      dataState: "human",
      icon: checkIcon(),
      title: "Likely Authentic",
      subtitle:
        pct == null
          ? "No significant AI manipulation detected."
          : `${100 - pct}% trust score · No significant AI manipulation detected.`,
    };
  }
  if (verdict === "mixed") {
    return {
      dataState: "mixed",
      icon: questionIcon(),
      title: "Uncertain — review advised",
      subtitle:
        pct == null
          ? "Some indicators suggest possible AI involvement."
          : `${pct}% AI likelihood · Mixed signals across frames.`,
    };
  }
  if (verdict === "ai") {
    return {
      dataState: "ai",
      icon: alertIcon(),
      title: "AI-Generated Content",
      subtitle:
        pct == null
          ? "High confidence this video is synthetically produced."
          : `${pct}% AI likelihood · High confidence this is synthetic.`,
    };
  }
  return {
    dataState: "scanning",
    icon: scanningIcon(),
    title: "Awaiting verdict",
    subtitle: "Pick a model and run a scan to inspect this video.",
  };
}

function checkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  );
}
function questionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1.5-2 3" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  );
}
function alertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function scanningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ animation: "yt-scan-spin 1.2s linear infinite" }}>
      <style>{`@keyframes yt-scan-spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}
