"use client";

import { useCallback, useRef } from "react";

interface Props {
  initial: string;
  isPlaceholder: boolean;
  onChange: (value: string) => void;
  /** Fired when the user finishes editing — on blur or when they press
   *  Enter. The value is trimmed and only fires when it differs from
   *  `initial` (the last persisted title) AND is non-empty. Restoring
   *  the placeholder on empty input is silent — we never persist that. */
  onCommit?: (value: string) => void;
  className?: string;
  dimClassName?: string;
}

export function EditableTitle({
  initial,
  isPlaceholder,
  onChange,
  onCommit,
  className,
  dimClassName,
}: Props) {
  // Track the last value we committed so blur after Enter doesn't fire
  // a duplicate save.
  const committedRef = useRef(initial);
  // Seed text on first mount only — never overwrite the user's edits when
  // the parent re-renders.
  const setRef = useCallback(
    (node: HTMLHeadingElement | null) => {
      if (node && !node.dataset.seeded) {
        node.textContent = initial;
        node.dataset.seeded = "1";
      }
    },
    [initial],
  );
  const cls = [className, isPlaceholder ? dimClassName : ""]
    .filter(Boolean)
    .join(" ");

  const tryCommit = (raw: string) => {
    const trimmed = raw.trim();
    if (!onCommit) return;
    if (trimmed === "" || trimmed === initial || trimmed === committedRef.current) {
      return;
    }
    committedRef.current = trimmed;
    onCommit(trimmed);
  };

  return (
    <h1
      ref={setRef}
      className={cls}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => onChange((e.currentTarget.textContent ?? "").trim())}
      onBlur={(e) => {
        const raw = (e.currentTarget.textContent ?? "").trim();
        if (raw === "") {
          e.currentTarget.textContent = initial;
          onChange(initial);
          return;
        }
        tryCommit(raw);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLHeadingElement).blur();
        }
      }}
    />
  );
}
