"use client";

import { useEffect, useRef, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { TypeChip } from "@/components/ui/TypeChip";
import { OriginBadge } from "@/components/ui/OriginBadge";
import { Icon } from "@/components/Icon";
import { Checkbox } from "./Checkbox";
import type { LibraryItem, LibrarySourceLink } from "@/lib/library-data";

export function LibraryRow({
  item,
  selected,
  onToggle,
}: {
  item: LibraryItem;
  selected: boolean;
  onToggle: (id: string, next: boolean) => void;
}) {
  return (
    <div
      className={`lib-row${selected ? " is-selected" : ""}`}
      onClick={() => onToggle(item.id, !selected)}
      role="row"
    >
      <Checkbox
        checked={selected}
        onChange={(next) => onToggle(item.id, next)}
        label={`Select ${item.name}`}
      />
      <TypeChip type={item.type} size="md" />

      <div className="lib-row-main">
        <div className="lib-row-name">{item.name}</div>
        <div className="lib-row-meta">
          <OriginBadge origin={item.origin} />
          {item.link ? (
            <SourceLink link={item.link} />
          ) : (
            <span>{item.source}</span>
          )}
          {item.meta && <span>{item.meta}</span>}
        </div>
      </div>

      <div className="lib-row-conf">
        <span className="lib-conf-bar" aria-hidden>
          <span style={{ width: `${item.confidence}%` }} />
        </span>
        <span>{item.confidence}%</span>
      </div>

      <div className="lib-row-model">{item.model}</div>

      <div>
        <Pill tone={item.verdict} dot compact>
          {item.verdictLabel}
        </Pill>
      </div>

      <div className="lib-row-time">{item.when}</div>

      <button
        type="button"
        className="lib-row-action"
        aria-label="Row actions"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon name="more" size={14} />
      </button>
    </div>
  );
}

function SourceLink({ link }: { link: LibrarySourceLink }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — silently ignore, no toast UI yet */
    }
  };

  return (
    <button
      type="button"
      className={`lib-row-link${copied ? " is-copied" : ""}`}
      onClick={handleCopy}
      aria-label={`Copy ${link.url}`}
      title="Copy link"
    >
      <span className="fmt">{link.format}</span>
      <span aria-hidden>·</span>
      <span>{link.id}</span>
      <Icon name={copied ? "check" : "link"} size={11} />
    </button>
  );
}
