"use client";

import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";

type Action = { key: string; label: string; icon: IconName; onClick?: () => void };

const ACTIONS: Action[] = [
  { key: "collect", label: "Add to collection", icon: "folder" },
  { key: "export", label: "Export report", icon: "file-text" },
  { key: "rescan", label: "Re-scan", icon: "refresh" },
  { key: "delete", label: "Delete", icon: "trash" },
];

export function SelectionBar({
  count,
  onClear,
  onAction,
}: {
  count: number;
  onClear: () => void;
  onAction?: (key: Action["key"]) => void;
}) {
  return (
    <div className="lib-sel-bar" role="region" aria-label={`${count} selected`}>
      <div className="lib-sel-left">
        <span className="lib-sel-count">{count} selected</span>
        <div className="lib-sel-actions">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              className="lib-sel-btn"
              onClick={() => onAction?.(a.key)}
            >
              <Icon name={a.icon} size={12} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="lib-sel-close"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
