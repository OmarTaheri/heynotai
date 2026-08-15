import { useEffect, useState } from 'react';
import { getScan, type Scan } from '@/lib/scans-api';
import type { ScanEntry } from '@/lib/types';

/** Resolve the backend record behind the verdict currently on screen.
 *
 *  Two things can produce a verdict in the drawer:
 *    - a cached scan for this URL (already a full `Scan`), or
 *    - a `SCAN_COMPLETE` broadcast, which only carries the four summary
 *      fields in `ScanEntry`.
 *
 *  The result card needs more than that — which detector ran, how
 *  confident it was, how long it took — so the second case is resolved
 *  back to the full record by id. Returns null while the fetch is in
 *  flight or when there is nothing to resolve; callers render the
 *  "not checked yet" signal set in that case rather than filler. */
export function useResultScan(
  cached: Scan | null,
  lastResult: ScanEntry | null,
): Scan | null {
  const [fetched, setFetched] = useState<Scan | null>(null);
  const scanId = lastResult?.scanId ?? null;

  useEffect(() => {
    if (!scanId) {
      setFetched(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const scan = await getScan(scanId).catch(() => null);
      if (!cancelled) setFetched(scan);
    })();
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  if (cached) return cached;
  if (fetched && fetched.id === scanId) return fetched;
  return null;
}
