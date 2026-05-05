"use client";

import { Icon } from "@/components/Icon";
import { Toolbar } from "@/components/editor-shell";
import { ChevronUp, Speaker, Style, Format, Compare, Duplicate, Export, Scan } from "./icons";

interface Props {
  flagIndex: number;
  flagTotal: number;
  scanning: boolean;
  highlightsOn: boolean;
  onPrev: () => void;
  onNext: () => void;
  onScan: () => void;
  onToggleHighlights: () => void;
}

/**
 * Text-editor-specific arrangement of toolbar buttons. Audio / image /
 * video editors will compose their own arrangements using the same
 * generic `Toolbar` primitive.
 */
export function TextEditorToolbar({
  flagIndex,
  flagTotal,
  scanning,
  highlightsOn,
  onPrev,
  onNext,
  onScan,
  onToggleHighlights,
}: Props) {
  return (
    <Toolbar>
      <Toolbar.Button
        tip={flagTotal === 0 ? "Per-sentence flags — coming soon" : "Previous flag"}
        onClick={onPrev}
        disabled={flagTotal === 0}
      >
        <ChevronUp />
      </Toolbar.Button>
      <Toolbar.Button
        tip={flagTotal === 0 ? "Per-sentence flags — coming soon" : "Next flag"}
        onClick={onNext}
        disabled={flagTotal === 0}
      >
        <Icon name="chevron-down" size={16} />
      </Toolbar.Button>
      <Toolbar.FlagCounter current={flagIndex + 1} total={flagTotal} />

      <Toolbar.Sep />

      <Toolbar.Button tip="Find">
        <Icon name="search" size={16} />
      </Toolbar.Button>
      <Toolbar.Button tip="Read aloud">
        <Speaker />
      </Toolbar.Button>
      <Toolbar.Button tip="Style">
        <Style />
      </Toolbar.Button>
      <Toolbar.Button tip="Text size">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
          16<span style={{ color: "var(--color-fg-dim)" }}>px</span>
        </span>
        <Icon name="chevron-down" size={11} />
      </Toolbar.Button>
      <Toolbar.Button tip="Format">
        <Format />
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

      <Toolbar.Button
        tip={highlightsOn ? "Hide highlights" : "Show highlights"}
        onClick={onToggleHighlights}
        active={highlightsOn}
        variant="info"
      >
        <Icon name="eye" size={16} />
      </Toolbar.Button>
      <Toolbar.ScanButton onClick={onScan} scanning={scanning}>
        <Scan size={18} />
      </Toolbar.ScanButton>
    </Toolbar>
  );
}
