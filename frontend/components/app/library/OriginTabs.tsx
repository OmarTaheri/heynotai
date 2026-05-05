"use client";

import { Icon } from "@/components/Icon";
import type { OriginTabKey } from "@/lib/library-data";

export type OriginTabRender = {
  key: OriginTabKey;
  label: string;
  count: number;
  locked?: boolean;
};

export function OriginTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: OriginTabRender[];
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
            {tab.locked && (
              <Icon name="lock" size={11} className="lib-tab-lock" />
            )}
            <span>{tab.label}</span>
            <span className="lib-tab-count">{tab.count.toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
