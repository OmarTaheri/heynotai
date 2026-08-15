"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import styles from "./VideoCanvas.module.css";

export interface VideoCanvasHandle {
  togglePlay: () => void;
  seekRelative: (deltaMs: number) => void;
  seekToMs: (ms: number) => void;
}

interface Props {
  src: string;
  scanning: boolean;
  playing: boolean;
  onTimeChange: (ms: number) => void;
  onDurationChange: (ms: number) => void;
  onPlayingChange: (playing: boolean) => void;
}


export const VideoCanvas = forwardRef<VideoCanvasHandle, Props>(function VideoCanvas(
  { src, scanning, playing, onTimeChange, onDurationChange, onPlayingChange },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => ({
    togglePlay() {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) v.play().catch(() => {});
      else v.pause();
    },
    seekRelative(deltaMs) {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(0, v.currentTime + deltaMs / 1000);
    },
    seekToMs(ms) {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(0, ms / 1000);
    },
  }));

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing && v.paused) v.play().catch(() => {});
    if (!playing && !v.paused) v.pause();
  }, [playing]);

  return (
    <div className={styles.player}>
      <video
        ref={videoRef}
        src={src}
        playsInline
        onLoadedMetadata={(e) =>
          onDurationChange(Math.round(e.currentTarget.duration * 1000))
        }
        onTimeUpdate={(e) =>
          onTimeChange(Math.round(e.currentTarget.currentTime * 1000))
        }
        onPlay={() => onPlayingChange(true)}
        onPause={() => onPlayingChange(false)}
        onEnded={() => onPlayingChange(false)}
      />
      {/* Progress indicator only. This used to draw five randomly-placed
          boxes labelled "Face 87%" / "AI 92%" — the video pipeline
          classifies sampled frames whole and returns no bounding boxes,
          so those overlays were inventing detections that never
          happened. Per-frame results, when the provider reports them,
          are surfaced as counts in the verdict panel. */}
      {scanning && (
        <div className={styles.scan} aria-hidden>
          <div className={styles.scanLabel}>Scanning frames</div>
        </div>
      )}
    </div>
  );
});
