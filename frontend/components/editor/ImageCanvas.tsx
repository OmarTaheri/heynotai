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

/** Full-frame reticle used during the scanning animation.
 *
 *  This used to be a randomly-placed box that jumped to a new region
 *  every 1.1s. Nothing localizes regions — the image detectors return a
 *  single whole-image probability — so a reticle that appeared to lock
 *  onto a face or a corner was claiming an analysis that never happened.
 *  It now frames the whole image, which is what is actually being sent. */
const FULL_FRAME: Target = { x: 4, y: 4, w: 92, h: 92 };

export function ImageCanvas({
  src,
  alt = "Image being analyzed",
  scanning,
  zoom,
  rotation,
}: Props) {
  const target = FULL_FRAME;

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
