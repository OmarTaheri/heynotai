"use client";

import { useEffect, useState } from "react";
import { LastScanCard, type LastScan } from "./LastScanCard";
import { listScans, ScanApiError } from "@/lib/scans-api";
import { DEMO_LAST_SCAN, scanToLastScan } from "@/lib/last-scan-data";

/** Fetches the user's most recent scan and renders the Last Scan card
 *  from real data. Falls back to DEMO_LAST_SCAN when the user has no
 *  scans yet, or when the request 401s (logged-out preview screens). */
export function LastScanCardClient() {
  const [scan, setScan] = useState<LastScan>(DEMO_LAST_SCAN);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listScans({ perPage: 1 });
        if (cancelled) return;
        const recent = result.items[0];
        if (recent) setScan(scanToLastScan(recent));
      } catch (err) {
        // 401 here just means no auth — keep the demo card so the page
        // still looks alive on logged-out preview screens. Other errors
        // also fall through to the demo rather than blowing up the home.
        if (err instanceof ScanApiError && err.status !== 401) {
          // swallow; demo fallback is fine
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <LastScanCard scan={scan} />;
}
