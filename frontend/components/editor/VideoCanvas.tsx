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

interface DetectBox {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

const BOX_COUNT = 5;
const LABELS = [
  undefined, undefined, undefined,
  "Face 87%", "Face 73%",
  "AI 92%", "AI 81%",
  "Object", "Frame",
  "78%", "65%",
];

function randomBox(id: number): DetectBox {
  const w = 12 + Math.random() * 24;
  const h = 14 + Math.random() * 26;
  const x = 4 + Math.random() * (92 - w);
  const y = 8 + Math.random() * (84 - h);
  const label = LABELS[Math.floor(Math.random() * LABELS.length)];
  return { id, x, y, w, h, label };
}

export const VideoCanvas = forwardRef<VideoCanvasHandle, Props>(function VideoCanvas(
  { src, scanning, playing, onTimeChange, onDurationChange, onPlayingChange },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [boxes, setBoxes] = useState<DetectBox[]>(() =>
    Array.from({ length: BOX_COUNT }, (_, i) => randomBox(i)),
  );

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

  useEffect(() => {
    if (!scanning) return;
    setBoxes(Array.from({ length: BOX_COUNT }, (_, i) => randomBox(i)));
  }, [scanning]);

  const respawn = (i: number) => {
    setBoxes((prev) => prev.map((b, idx) => (idx === i ? randomBox(b.id) : b)));
  };

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
      {scanning && (
        <div className={styles.scan} aria-hidden>
          {boxes.map((box, i) => (
            <div
              key={`${box.id}-${box.x}-${box.y}`}
              className={styles.detectBox}
              style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.w}%`,
                height: `${box.h}%`,
                animationDelay: `${i * 0.28}s`,
              } as CSSProperties}
              onAnimationIteration={() => respawn(i)}
            >
              {box.label && (
                <span className={styles.detectLabel}>{box.label}</span>
              )}
            </div>
          ))}
          <div className={styles.scanLabel}>Scanning frames</div>
        </div>
      )}
    </div>
  );
});
