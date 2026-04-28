"use client";

import type { OriginTabKey } from "@/lib/library-data";

export function OriginTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: OriginTabKey; label: string; count: number }[];
  value: OriginTabKey;
  onChange: (next: OriginTabKey) => void;
}) {
  return (
    <div className="lib-tabs" role="tablist" aria-label="Filter by origin">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`lib-tab${active ? " is-active" : ""}`}
            onClick={() => onChange(tab.key)}
          >
            <span>{tab.label}</span>
            <span className="lib-tab-count">{tab.count.toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
