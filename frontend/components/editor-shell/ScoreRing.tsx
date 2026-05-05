"use client";

import { useEffect, useState } from "react";
import styles from "./ScoreRing.module.css";

export type Verdict = "human" | "ai" | "mixed";

const COLOR_FOR_VERDICT: Record<Verdict, string> = {
  human: "var(--color-human)",
  ai: "var(--color-ai)",
  mixed: "var(--color-mixed)",
};

interface Props {
  value: number;
  size?: number;
  stroke?: number;
  verdict?: Verdict;
  showNumber?: boolean;
  trackColor?: string;
  numClassName?: string;
}

export function ScoreRing({
  value,
  size = 32,
  stroke = 3,
  verdict = "ai",
  showNumber = true,
  trackColor = "var(--color-line-strong)",
  numClassName,
}: Props) {
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const fill = (safe / 100) * c;
  const center = size / 2;

  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    setDisplayed(0);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDisplayed(fill));
    });
    return () => cancelAnimationFrame(id);
  }, [fill]);

  return (
    <span className={styles.ring} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        aria-hidden
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
          strokeDasharray="3 3"
          className={styles.ringTrack}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={COLOR_FOR_VERDICT[verdict]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${displayed.toFixed(2)} ${(c - displayed).toFixed(2)}`}
          className={styles.ringFg}
        />
      </svg>
      {showNumber && (
        <span className={`${styles.num}${numClassName ? ` ${numClassName}` : ""}`}>
          {safe}
        </span>
      )}
    </span>
  );
}

export function verdictFromScore(score: number): Verdict {
  if (score >= 75) return "human";
  if (score >= 45) return "mixed";
  return "ai";
}
