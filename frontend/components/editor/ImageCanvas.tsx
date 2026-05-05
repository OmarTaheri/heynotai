"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import styles from "./ImageCanvas.module.css";

interface Props {
  src: string;
  alt?: string;
  scanning: boolean;
  zoom: number;
  rotation: number;
}

interface Target {
  x: number; // % from left
  y: number; // % from top
  w: number; // % of width
  h: number; // % of height
}

function randomTarget(prev?: Target): Target {
  // Vary the box dimensions noticeably so each lock-on feels different —
  // sometimes a tall portrait, sometimes a wide letterbox slice.
  const w = 18 + Math.random() * 28; // 18% – 46%
  const h = 18 + Math.random() * 32; // 18% – 50%
  const x = 4 + Math.random() * (92 - w);
  const y = 4 + Math.random() * (90 - h);
  const next = { x, y, w, h };
  // Avoid landing on essentially the same region two frames in a row.
  if (
    prev &&
    Math.abs(prev.x - next.x) < 8 &&
    Math.abs(prev.y - next.y) < 8
  ) {
    return randomTarget(prev);
  }
  return next;
}

export function ImageCanvas({
  src,
  alt = "Image being analyzed",
  scanning,
  zoom,
  rotation,
}: Props) {
  const [target, setTarget] = useState<Target>(() => randomTarget());

  useEffect(() => {
    if (!scanning) return;
    setTarget((prev) => randomTarget(prev));
    const id = setInterval(() => {
      setTarget((prev) => randomTarget(prev));
    }, 1100);
    return () => clearInterval(id);
  }, [scanning]);

  const imgStyle: CSSProperties = {
    transform: `scale(${zoom}) rotate(${rotation}deg)`,
  };

  const reticleStyle: CSSProperties = {
    left: `${target.x}%`,
    top: `${target.y}%`,
    width: `${target.w}%`,
    height: `${target.h}%`,
  };

  return (
    <div className={`${styles.frame}${scanning ? ` ${styles.frameScanning}` : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={imgStyle} draggable={false} />
      {scanning && (
        <div className={styles.scan} aria-hidden>
          <div className={styles.scanGrid} />
          <div className={styles.scanReticle} style={reticleStyle}>
            <span className={`${styles.corner} ${styles.cornerTL}`} />
            <span className={`${styles.corner} ${styles.cornerTR}`} />
            <span className={`${styles.corner} ${styles.cornerBL}`} />
            <span className={`${styles.corner} ${styles.cornerBR}`} />
            <span className={styles.scanLine} />
          </div>
          <div className={styles.scanLabel}>Analyzing</div>
        </div>
      )}
    </div>
  );
}
