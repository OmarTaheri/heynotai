"use client";

import type { UploadSubTabKey } from "@/lib/library-data";

export type UploadSubTabRender = {
  key: UploadSubTabKey;
  label: string;
  count: number;
};

/**
 * Sub-tab strip rendered when the Uploads origin tab is active. Splits
 * uploads by media type (Image / Video / Audio) so the user can drill
 * in without picking from the Type filter dropdown. Same visual
 * language as OriginTabs, slightly tighter padding via .lib-subtabs.
 */
export function UploadSubTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: UploadSubTabRender[];
  value: UploadSubTabKey;
  onChange: (next: UploadSubTabKey) => void;
}) {
  return (
    <div
      className="lib-tabs lib-subtabs"
      role="tablist"
      aria-label="Filter uploads by media type"
    >
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
