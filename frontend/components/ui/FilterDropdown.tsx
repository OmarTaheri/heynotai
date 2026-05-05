"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { FilterChip } from "@/components/app/library/FilterChip";
import styles from "./FilterDropdown.module.css";

export type FilterDropdownOption = {
  key: string;
  label: string;
  selected: boolean;
};

/**
 * Filter chip + popover. Owns its own open state, click-outside, and
 * Escape behavior. Single-select: the parent decides whether re-picking
 * the active option clears the filter (via onPick).
 */
export function FilterDropdown({
  label,
  value,
  active,
  options,
  onPick,
  emptyHint,
}: {
  label: string;
  value?: string;
  active?: boolean;
  options: FilterDropdownOption[];
  onPick: (key: string) => void;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <FilterChip
        label={label}
        value={value}
        active={active}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className={styles.menu} role="listbox">
          {options.length === 0 && emptyHint && (
            <div className={styles.empty}>{emptyHint}</div>
          )}
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="option"
              aria-selected={opt.selected}
              className={`${styles.opt}${opt.selected ? ` ${styles.optSelected}` : ""}`}
              onClick={() => {
                onPick(opt.key);
                setOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {opt.selected && <Icon name="check" size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
