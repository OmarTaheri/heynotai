"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivityTable, type ActivityRow } from "./ActivityTable";
import { listScans, ScanApiError } from "@/lib/scans-api";
import { scanToLibraryItem } from "@/lib/library-data";
import { getScanCollections } from "@/lib/collection-items";
import { useScansRealtime } from "@/lib/use-scans-realtime";

const RECENT_LIMIT = 5;

/** Client wrapper that fetches the user's most recent scans and renders
 *  them via the presentational ActivityTable. Rows navigate to the
 *  per-scan editor. Refetches on every realtime tick so a scan started
 *  from the extension lands here without a page reload. */
export function ActivityTableClient() {
  const router = useRouter();
  const realtimeTick = useScansRealtime();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listScans({ perPage: RECENT_LIMIT });
        if (cancelled) return;
        const collections = await getScanCollections(
          result.items.map((s) => s.id),
        );
        if (cancelled) return;
        setRows(
          result.items.map((scan) => {
            const ref = collections.get(scan.id);
            const item = scanToLibraryItem(scan, {
              collection: ref
                ? {
                    title: ref.title,
                    href: `/app/collections/${ref.slug || ref.id}`,
                  }
                : undefined,
            });
            return {
              id: item.id,
              type: item.type,
              name: item.name,
              origin: item.origin,
              meta: item.meta,
              link: item.link,
              aiPct: item.aiPct,
              confidence: item.confidence,
              when: item.when,
            };
          }),
        );
      } catch (err) {
        if (cancelled) return;
        // 401 here just means no auth — render an empty state rather
        // than blowing up the home page for logged-out preview screens.
        if (err instanceof ScanApiError && err.status !== 401) {
          // swallow; the empty table is a fine fallback for other errors
        }
        setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [realtimeTick]);

  return (
    <ActivityTable
      rows={rows ?? []}
      onRowClick={(id) => router.push(`/editor/${id}`)}
    />
  );
}
