"use client";

import { useMemo, useState } from "react";
import { UPDATES, UNREAD_INITIAL } from "@/lib/updates-data";
import { UpdatesHeader } from "./UpdatesHeader";
import { UpdatesFilters, type FilterKey } from "./UpdatesFilters";
import { UpdatesTimeline } from "./UpdatesTimeline";
import { SubscribeFooter } from "./SubscribeFooter";

/**
 * Client shell for /app/updates. Owns the kind filter and the per-id
 * read set. The data source is a static module — swap for a fetch when
 * the changelog API lands; the rest of the tree won't need to change.
 */
export function UpdatesClient() {
  const [active, setActive] = useState<FilterKey>("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => (active === "all" ? UPDATES : UPDATES.filter((u) => u.kind === active)),
    [active],
  );

  const counts = useMemo<Record<FilterKey, number>>(() => {
    const c: Record<FilterKey, number> = {
      all: UPDATES.length,
      "new-model": 0,
      accuracy: 0,
      product: 0,
      fix: 0,
    };
    for (const u of UPDATES) c[u.kind] += 1;
    return c;
  }, []);

  const unreadCount = useMemo(
    () => UNREAD_INITIAL.filter((id) => !readIds.has(id)).length,
    [readIds],
  );

  const markAllRead = () => setReadIds(new Set(UNREAD_INITIAL));

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
      <UpdatesTimeline items={visible} readIds={readIds} />
      <SubscribeFooter />
    </div>
  );
}
