"use client";

import { useEffect, useState } from "react";
import { pb } from "./pocketbase";
import type {
  AccuracyCompare,
  ModelPreview,
  StatBandItem,
  UpdateContentType,
  UpdateItem,
  UpdateKind,
  DayGroup,
} from "./updates-data";

type PBUpdateRecord = {
  id: string;
  slug: string;
  kind: UpdateKind;
  contentType?: UpdateContentType | "";
  dayGroup: DayGroup;
  timestamp: string;
  publishedAt?: string;
  title: string;
  description?: string;
  meta?: string;
  ctaLabel?: string;
  ctaHref?: string;
  unread?: boolean;
  modelPreview?: ModelPreview | null;
  accuracyCompare?: AccuracyCompare | null;
  statBand?: StatBandItem[] | null;
  sortOrder?: number;
};

function toItem(r: PBUpdateRecord): UpdateItem {
  return {
    id: r.slug || r.id,
    kind: r.kind,
    contentType: r.contentType ? (r.contentType as UpdateContentType) : undefined,
    dayGroup: r.dayGroup,
    timestamp: r.timestamp,
    title: r.title,
    description: r.description ?? "",
    meta: r.meta || undefined,
    cta: r.ctaLabel ? { label: r.ctaLabel, href: r.ctaHref || undefined } : undefined,
    unread: r.unread || undefined,
    modelPreview: r.modelPreview || undefined,
    accuracyCompare: r.accuracyCompare || undefined,
    statBand: Array.isArray(r.statBand) && r.statBand.length ? r.statBand : undefined,
  };
}

/** Loads `/app/updates` content from the PocketBase `updates` collection
 *  and subscribes to realtime so admin edits appear without a refresh.
 *  Sorts by `sortOrder` (ascending) — the seed assigns 1..N matching
 *  the original static order. */
export function useUpdates() {
  const [items, setItems] = useState<UpdateItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await pb
          .collection("updates")
          .getFullList<PBUpdateRecord>({ sort: "sortOrder,-publishedAt" });
        if (cancelled) return;
        setItems(res.map(toItem));
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load updates");
        setItems([]);
      }
    };

    void load();

    let unsub: (() => void) | null = null;
    void pb
      .collection("updates")
      .subscribe<PBUpdateRecord>("*", () => {
        // Re-fetch the full list on any change. The collection is small
        // (~tens of rows) so we don't bother patching by id.
        void load();
      })
      .then((u) => {
        if (cancelled) {
          void u();
        } else {
          unsub = u;
        }
      })
      .catch(() => {
        // Realtime can fail when unauthenticated — already handled by
        // the initial load() error path. Static rendering still works.
      });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return { items, loading: items === null, error };
}
