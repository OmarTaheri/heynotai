"use client";

import { useMemo, useState } from "react";
import { useUpdates } from "@/lib/use-updates";
import { UpdatesHeader } from "./UpdatesHeader";
import { UpdatesFilters, type FilterKey } from "./UpdatesFilters";
import { UpdatesTimeline } from "./UpdatesTimeline";
import { SubscribeFooter } from "./SubscribeFooter";

/**
 * Client shell for /app/updates. Owns the kind filter and the per-id
 * read set. Data comes from the PocketBase `updates` collection via
 * `useUpdates`, which also subscribes to realtime so admin edits in
 * the PB UI appear here without a page refresh.
 */
export function UpdatesClient() {
  const { items, loading } = useUpdates();
  const all = useMemo(() => items ?? [], [items]);

  const [active, setActive] = useState<FilterKey>("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => (active === "all" ? all : all.filter((u) => u.kind === active)),
    [active, all],
  );

  const counts = useMemo<Record<FilterKey, number>>(() => {
    const c: Record<FilterKey, number> = {
      all: all.length,
      "new-model": 0,
      accuracy: 0,
      product: 0,
      fix: 0,
    };
    for (const u of all) c[u.kind] += 1;
    return c;
  }, [all]);

  const unreadIds = useMemo(
    () => all.filter((u) => u.unread).map((u) => u.id),
    [all],
  );

  const unreadCount = useMemo(
    () => unreadIds.filter((id) => !readIds.has(id)).length,
    [unreadIds, readIds],
  );

  const markAllRead = () => setReadIds(new Set(unreadIds));

  return (
    <div className="updates panel-reveal">
      <UpdatesHeader version="v4.7.2" />
      <UpdatesFilters
        active={active}
        counts={counts}
        unreadCount={unreadCount}
        onChange={setActive}
        onMarkAllRead={markAllRead}
      />
      {loading ? (
        <div style={{ padding: "2rem 1rem", opacity: 0.6 }}>Loading updates…</div>
      ) : (
        <UpdatesTimeline items={visible} readIds={readIds} />
      )}
      <SubscribeFooter />
    </div>
  );
}
