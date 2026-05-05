"use client";

import { Icon } from "@/components/Icon";
import { Toolbar } from "@/components/editor-shell";
import { Compare, Export, Scan } from "./icons";

interface Props {
  scanning: boolean;
  playing: boolean;
  currentMs: number;
  durationMs: number;
  onScan: () => void;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
}

export function VideoEditorToolbar({
  scanning,
  playing,
  currentMs,
  durationMs,
  onScan,
  onTogglePlay,
  onStepBack,
  onStepForward,
}: Props) {
  return (
    <Toolbar>
      <Toolbar.Button tip="Step back 1s" onClick={onStepBack}>
        <StepBack />
      </Toolbar.Button>
      <Toolbar.Button tip={playing ? "Pause" : "Play"} onClick={onTogglePlay}>
        {playing ? <PauseGlyph /> : <PlayGlyph />}
      </Toolbar.Button>
      <Toolbar.Button tip="Step forward 1s" onClick={onStepForward}>
        <StepForward />
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
      <Toolbar.Button tip="Loop">
        <LoopGlyph />
      </Toolbar.Button>

      <Toolbar.Sep />

      <Toolbar.Button tip="Re-run flow">
        <Icon name="refresh" size={16} />
      </Toolbar.Button>
      <Toolbar.Button tip="Compare">
        <Compare />
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
const StepBack = () => (
  <svg {...G}>
    <polygon points="11 6 4 12 11 18" fill="currentColor" stroke="none" />
    <line x1="20" y1="5" x2="20" y2="19" />
  </svg>
);
const StepForward = () => (
  <svg {...G}>
    <polygon points="13 6 20 12 13 18" fill="currentColor" stroke="none" />
    <line x1="4" y1="5" x2="4" y2="19" />
  </svg>
);
const LoopGlyph = () => (
  <svg {...G}>
    <path d="M17 1l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 23l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
