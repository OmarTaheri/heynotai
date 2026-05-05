"use client";

import { Icon } from "@/components/Icon";
import { Toolbar } from "@/components/editor-shell";
import { Compare, Duplicate, Export, Scan } from "./icons";

interface Props {
  scanning: boolean;
  zoom: number;
  onScan: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRotate: () => void;
}

export function ImageEditorToolbar({
  scanning,
  zoom,
  onScan,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onRotate,
}: Props) {
  return (
    <Toolbar>
      <Toolbar.Button tip="Zoom out" onClick={onZoomOut}>
        <ZoomOutGlyph />
      </Toolbar.Button>
      <Toolbar.Button tip="Reset zoom" onClick={onZoomReset}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
          {Math.round(zoom * 100)}
          <span style={{ color: "var(--color-fg-dim)" }}>%</span>
        </span>
      </Toolbar.Button>
      <Toolbar.Button tip="Zoom in" onClick={onZoomIn}>
        <ZoomInGlyph />
      </Toolbar.Button>
      <Toolbar.Button tip="Rotate 90°" onClick={onRotate}>
        <RotateGlyph />
      </Toolbar.Button>
      <Toolbar.Button tip="Crop">
        <CropGlyph />
      </Toolbar.Button>

      <Toolbar.Sep />

      <Toolbar.Button tip="Re-run flow">
        <Icon name="refresh" size={16} />
      </Toolbar.Button>
      <Toolbar.Button tip="Compare">
        <Compare />
      </Toolbar.Button>
      <Toolbar.Button tip="Duplicate">
        <Duplicate />
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

const G_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ZoomInGlyph = () => (
  <svg {...G_PROPS}>
    <circle cx="11" cy="11" r="6" />
    <path d="M11 8v6M8 11h6" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const ZoomOutGlyph = () => (
  <svg {...G_PROPS}>
    <circle cx="11" cy="11" r="6" />
    <path d="M8 11h6" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const RotateGlyph = () => (
  <svg {...G_PROPS}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <polyline points="3 4 3 9 8 9" />
  </svg>
);
const CropGlyph = () => (
  <svg {...G_PROPS}>
    <path d="M6 3v15a1 1 0 0 0 1 1h15" />
    <path d="M3 6h15a1 1 0 0 1 1 1v15" />
  </svg>
);
