"use client";

import { Icon } from "@/components/Icon";

/**
 * Tiny square checkbox used in the library table — header (select-all)
 * and per-row. Controlled. Click handler is passed up so the parent
 * row can also toggle from a row-click without re-running this.
 */
export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? "Select row"}
      className={`lib-ck${checked ? " is-checked" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    >
      {checked && <Icon name="check" size={10} />}
    </button>
  );
}
