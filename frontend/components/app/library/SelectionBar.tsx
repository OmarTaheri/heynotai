"use client";

import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";

export type SelectionAction = {
  key: string;
  label: string;
  icon: IconName;
};

const DEFAULT_ACTIONS: SelectionAction[] = [
  { key: "collect", label: "Add to collection", icon: "folder" },
  { key: "rescan", label: "Re-scan", icon: "refresh" },
  { key: "delete", label: "Delete", icon: "trash" },
];

export function SelectionBar({
  count,
  onClear,
  onAction,
  actions,
  disabled,
}: {
  count: number;
  onClear: () => void;
  onAction?: (key: string) => void;
  /** Override the default library action set (e.g. collection page
   *  passes its own [remove, delete]). */
  actions?: SelectionAction[];
  /** Greys out the action buttons but keeps the bar visible (used in
   *  mock-mode where bulk mutations would no-op). */
  disabled?: boolean;
}) {
  const list = actions ?? DEFAULT_ACTIONS;
  return (
    <div className="lib-sel-bar" role="region" aria-label={`${count} selected`}>
      <div className="lib-sel-left">
        <span className="lib-sel-count">{count} selected</span>
        <div className="lib-sel-actions">
          {list.map((a) => (
            <button
              key={a.key}
              type="button"
              className="lib-sel-btn"
              onClick={() => onAction?.(a.key)}
              disabled={disabled}
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
