"use client";

import { useEffect, useState } from "react";
import styles from "./ScoreRing.module.css";

export type RingTone = "ai" | "human" | "mixed" | "info";

const TONE_VAR: Record<RingTone, string> = {
  ai: "var(--color-strike)",
  human: "var(--color-human)",
  mixed: "var(--color-mixed)",
  info: "var(--color-accent)",
};

/**
 * Circular score ring with the value rendered in the middle.
 *
 *   <ScoreRing score={89} tone="ai" />
 *
 * `score` is 0–100. Outer track is a dashed line-color ring; inner arc
 * uses the tone color and animates from 0 to its final length on mount.
 * Stroke layout mirrors the extension's RingScore.
 */
export function ScoreRing({
  score,
  tone = "info",
  size = 76,
  strokeWidth = 5,
}: {
  score: number;
  tone?: RingTone;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const fill = (clamped / 100) * circumference;
  const center = size / 2;

  const [displayFill, setDisplayFill] = useState(0);

  useEffect(() => {
    setDisplayFill(0);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDisplayFill(fill));
    });
    return () => cancelAnimationFrame(id);
  }, [fill]);

  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth={strokeWidth}
          strokeDasharray="3 3"
        />
        <circle
          className={styles.arc}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={TONE_VAR[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${displayFill} ${circumference - displayFill}`}
        />
      </svg>
      <div className={styles.label}>
        <span>
          {Math.round(clamped)}
          <span className={styles.unit}>%</span>
        </span>
      </div>
    </div>
  );
}
