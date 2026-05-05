"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import styles from "./AudioCanvas.module.css";

export interface AudioCanvasHandle {
  togglePlay: () => void;
  seekRelative: (deltaMs: number) => void;
}

interface Props {
  src: string;
  scanning: boolean;
  durationMs: number;
  currentMs: number;
  playing: boolean;
  onTimeChange: (ms: number) => void;
  onDurationChange: (ms: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

const BAR_COUNT = 120;
const BAR_DELAY_MS = 25;
const PULSE_MS = 600;
// LTR sweep takes (BAR_COUNT - 1) × BAR_DELAY_MS for the wave front to
// reach the right edge. The RTL sweep starts at exactly that moment, so
// the bar at the right edge fires both pulses overlapping — that overlap
// is what reads as a "bounce" off the wall.
const LTR_SWEEP_MS = (BAR_COUNT - 1) * BAR_DELAY_MS;
const BOUNCE_TOTAL_MS = LTR_SWEEP_MS * 2 + PULSE_MS;
type ScanPhase = "bounce" | "full" | null;

export const AudioCanvas = forwardRef<AudioCanvasHandle, Props>(function AudioCanvas(
  {
    src,
    scanning,
    durationMs,
    currentMs,
    playing,
    onTimeChange,
    onDurationChange,
    onPlayingChange,
  },
  ref,
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>(null);

  // Two scan phases:
  //   1. "bounce": each bar runs two short pulses — LTR pass + RTL pass.
  //      Their delays are arranged so the right-edge bar fires both
  //      overlapping, which makes the wave visually bounce off the wall
  //      and head back instead of teleporting.
  //   2. "full": one synchronous burst on every bar that fades to base.
  // The page's runScan timeout is sized to cover both phases plus a
  // small tail before the verdict card appears.
  useEffect(() => {
    if (!scanning) {
      setScanPhase(null);
      return;
    }
    setScanPhase("bounce");
    const t = setTimeout(() => setScanPhase("full"), BOUNCE_TOTAL_MS);
    return () => clearTimeout(t);
  }, [scanning]);

  // Deterministic synthetic waveform — no decoding, but visually plausible.
  const bars = useMemo(() => {
    const out: number[] = [];
    let seed = 7;
    for (let i = 0; i < BAR_COUNT; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const r = seed / 233280;
      const swell = Math.sin((i / BAR_COUNT) * Math.PI * 3) * 0.35 + 0.6;
      const v = Math.max(0.08, Math.min(1, swell * (0.55 + r * 0.5)));
      out.push(v);
    }
    return out;
  }, []);

  useImperativeHandle(ref, () => ({
    togglePlay() {
      const a = audioRef.current;
      if (!a) return;
      if (a.paused) a.play().catch(() => {});
      else a.pause();
    },
    seekRelative(deltaMs) {
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = Math.max(0, a.currentTime + deltaMs / 1000);
    },
  }));

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing && a.paused) a.play().catch(() => {});
    if (!playing && !a.paused) a.pause();
  }, [playing]);

  const safeDuration = Math.max(durationMs, 1);
  const playedRatio = Math.min(1, currentMs / safeDuration);
  const playedBars = Math.floor(playedRatio * bars.length);

  const handleWaveClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = waveRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = (ratio * safeDuration) / 1000;
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.waveCard}>
        <div ref={waveRef} className={styles.wave} onClick={handleWaveClick}>
          {bars.map((v, i) => {
            let scanCls = "";
            let animationDelay: string | undefined;
            if (scanPhase === "bounce") {
              scanCls = styles.barBounce;
              const ltrDelay = i * BAR_DELAY_MS;
              const rtlDelay =
                LTR_SWEEP_MS + (BAR_COUNT - 1 - i) * BAR_DELAY_MS;
              animationDelay = `${ltrDelay}ms, ${rtlDelay}ms`;
            } else if (scanPhase === "full") {
              scanCls = styles.barFinale;
            }
            const cls = [
              styles.bar,
              !scanPhase && i < playedBars ? styles.barPlayed : "",
              scanCls,
            ]
              .filter(Boolean)
              .join(" ");
            const style: CSSProperties = {
              height: `${v * 100}%`,
              ...(animationDelay ? { animationDelay } : {}),
            };
            return <span key={i} className={cls} style={style} />;
          })}

          {!scanPhase && (
            <div
              className={styles.head}
              style={{ left: `${playedRatio * 100}%` }}
            />
          )}
        </div>

        <div className={styles.times}>
          <span>{fmt(currentMs)}</span>
          <span>{fmt(durationMs)}</span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
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
    </div>
  );
});

function fmt(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
