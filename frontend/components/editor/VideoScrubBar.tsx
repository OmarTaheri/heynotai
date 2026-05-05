"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import styles from "./VideoScrubBar.module.css";

interface Props {
  currentMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
}

interface ToolbarLayout {
  left: number;
  width: number;
}

export function VideoScrubBar({ currentMs, durationMs, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<ToolbarLayout | null>(null);

  useEffect(() => {
    const toolbar = document.querySelector<HTMLElement>(
      "[data-editor-toolbar]",
    );
    if (!toolbar) return;
    const measure = () => {
      const r = toolbar.getBoundingClientRect();
      setLayout({ left: r.left, width: r.width });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(toolbar);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const safeDuration = Math.max(durationMs, 1);
  const playedPct = Math.min(
    100,
    Math.max(0, (currentMs / safeDuration) * 100),
  );

  const seekToClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    onSeek(ratio * safeDuration);
  };

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    seekToClientX(e.clientX);
    const onMove = (m: MouseEvent) => seekToClientX(m.clientX);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const style: CSSProperties = layout
    ? { left: `${layout.left}px`, width: `${layout.width}px` }
    : { visibility: "hidden" };

  return (
    <div
      ref={trackRef}
      className={styles.bar}
      style={style}
      onMouseDown={handleMouseDown}
      role="slider"
      aria-label="Seek video"
      aria-valuemin={0}
      aria-valuemax={Math.round(safeDuration / 1000)}
      aria-valuenow={Math.round(currentMs / 1000)}
      tabIndex={0}
    >
      <div className={styles.track}>
        <div className={styles.played} style={{ width: `${playedPct}%` }} />
        <div className={styles.head} style={{ left: `${playedPct}%` }} />
      </div>
    </div>
  );
}
