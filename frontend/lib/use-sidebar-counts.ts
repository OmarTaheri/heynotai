"use client";

import { useEffect, useState } from "react";
import { pb } from "./pocketbase";
import { useAuth } from "./auth";
import { useUpdates } from "./use-updates";
import { listScans } from "./scans-api";

export type SidebarCounts = {
  collections: number | undefined;
  library: number | undefined;
  updatesUnread: number | undefined;
};

/**
 * Live counts for the sidebar badges. Returns `undefined` for any
 * dimension that hasn't loaded (or failed) so the caller can skip
 * rendering a stale "0" instead of flashing one.
 *
 *   collections    — total collections the viewer can see (PB realtime)
 *   library        — total scans owned by the viewer (REST `totalItems`)
 *   updatesUnread  — unread updates feed entries (PB realtime via useUpdates)
 *
 * Library has no realtime channel today, so we re-fetch when the tab
 * regains focus — cheap and matches users' mental model of "freshen on
 * return". Collections piggybacks on the existing `collections`
 * subscription and Updates inherits realtime from `useUpdates`.
 */
export function useSidebarCounts(): SidebarCounts {
  const { user } = useAuth();
  const userId = user?.id;

  const [collections, setCollections] = useState<number | undefined>(undefined);
  const [library, setLibrary] = useState<number | undefined>(undefined);

  // Updates: reuse the realtime hook the page already runs.
  const { items: updateItems } = useUpdates();
  const updatesUnread = updateItems
    ? updateItems.filter((u) => u.unread).length
    : undefined;

  useEffect(() => {
    if (!userId) {
      setCollections(undefined);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const list = await pb.collection("collections").getFullList({
          fields: "id",
          requestKey: "sidebar-collections",
        });
        if (!cancelled) setCollections(list.length);
      } catch {
        if (!cancelled) setCollections(undefined);
      }
    };

    void load();

    let unsub: (() => void) | null = null;
    void pb
      .collection("collections")
      .subscribe("*", () => {
        void load();
      })
      .then((u) => {
        if (cancelled) void u();
        else unsub = u;
      })
      .catch(() => {
        // Realtime is best-effort — initial load() already covered errors.
      });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLibrary(undefined);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const result = await listScans({ page: 1, perPage: 1 });
        if (!cancelled) setLibrary(result.totalItems);
      } catch {
        if (!cancelled) setLibrary(undefined);
      }
    };

    void load();

    const onFocus = () => void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  return { collections, library, updatesUnread };
}
