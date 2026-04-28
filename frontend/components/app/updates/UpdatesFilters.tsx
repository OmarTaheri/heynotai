"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { type UpdateKind } from "@/lib/updates-data";
import styles from "./UpdatesFilters.module.css";

export type FilterKey = UpdateKind | "all";

const TABS: { key: FilterKey; label: string; kindForDot?: UpdateKind }[] = [
  { key: "all", label: "All" },
  { key: "new-model", label: "New models", kindForDot: "new-model" },
  { key: "accuracy", label: "Accuracy", kindForDot: "accuracy" },
  { key: "product", label: "Product", kindForDot: "product" },
  { key: "fix", label: "Fixes", kindForDot: "fix" },
];

export function UpdatesFilters({
  active,
  counts,
  unreadCount,
  onChange,
  onMarkAllRead,
}: {
  active: FilterKey;
  counts: Record<FilterKey, number>;
  unreadCount: number;
  onChange: (key: FilterKey) => void;
  onMarkAllRead: () => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.tabs} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            className={styles.tab}
            data-active={active === tab.key ? "true" : undefined}
            onClick={() => onChange(tab.key)}
          >
            {tab.kindForDot && (
              <span
                className={styles.dot}
                data-kind={tab.kindForDot}
                aria-hidden
              />
            )}
            <span>{tab.label}</span>
            <span className={styles.count}>{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      <div className={styles.right}>
        {unreadCount > 0 && (
          <span className={styles.unread}>{unreadCount} new</span>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
        >
          <Icon name="check" size={12} />
          Mark all read
        </Button>
        <Button variant="secondary" size="sm">
          <Icon name="share" size={12} />
          RSS
        </Button>
      </div>
    </div>
  );
}
