"use client";

import { Icon } from "@/components/Icon";
import { Toolbar } from "@/components/editor-shell";
import { Export, Scan } from "./icons";

interface Props {
  scanning: boolean;
  playing: boolean;
  currentMs: number;
  durationMs: number;
  onScan: () => void;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
}

export function AudioEditorToolbar({
  scanning,
  playing,
  currentMs,
  durationMs,
  onScan,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
}: Props) {
  return (
    <Toolbar>
      <Toolbar.Button tip="Skip back 5s" onClick={onSkipBack}>
        <SkipBack />
      </Toolbar.Button>
      <Toolbar.Button tip={playing ? "Pause" : "Play"} onClick={onTogglePlay}>
        {playing ? <PauseGlyph /> : <PlayGlyph />}
      </Toolbar.Button>
      <Toolbar.Button tip="Skip forward 5s" onClick={onSkipForward}>
        <SkipForward />
      </Toolbar.Button>
      <Toolbar.Button tip="Time">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
          {fmtMs(currentMs)}
          <span style={{ color: "var(--color-fg-dim)" }}>
            {" / "}
            {fmtMs(durationMs)}
          </span>
        </span>
      </Toolbar.Button>
      <Toolbar.Button tip="Volume">
        <VolumeGlyph />
      </Toolbar.Button>
      <Toolbar.Button tip="Loudness (LUFS)">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          −14<span style={{ color: "var(--color-fg-dim)" }}>LUFS</span>
        </span>
      </Toolbar.Button>

      <Toolbar.Sep />

      <Toolbar.Button tip="Re-run flow">
        <Icon name="refresh" size={16} />
      </Toolbar.Button>
      <Toolbar.Button tip="Export">
        <Export />
      </Toolbar.Button>

      <Toolbar.Sep />

      <Toolbar.ScanButton onClick={onScan} scanning={scanning}>
        <Scan size={18} />
      </Toolbar.ScanButton>
    </Toolbar>
  );
}

function fmtMs(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const G = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PlayGlyph = () => (
  <svg {...G} fill="currentColor" stroke="none">
    <path d="M7 5v14l12-7z" />
  </svg>
);
const PauseGlyph = () => (
  <svg {...G} fill="currentColor" stroke="none">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const SkipBack = () => (
  <svg {...G}>
    <path d="M11 18 4 12l7-6" />
    <path d="M21 18 14 12l7-6" />
  </svg>
);
const SkipForward = () => (
  <svg {...G}>
    <path d="M13 18l7-6-7-6" />
    <path d="M3 18l7-6-7-6" />
  </svg>
);
const VolumeGlyph = () => (
  <svg {...G}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15 9a3 3 0 0 1 0 6" />
  </svg>
);
