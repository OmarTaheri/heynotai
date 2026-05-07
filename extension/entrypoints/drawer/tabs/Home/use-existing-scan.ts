import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-state';
import { pb } from '@/lib/pocketbase';
import { findExistingYouTubeScan, type Scan } from '@/lib/scans-api';

/** Look up a previously-completed scan for the given canonical source
 *  URL. Used by the Home tab so a paused YouTube/IG/FB platform still
 *  shows a cached verdict instead of the "platform deactivated" idle
 *  card — the user already paid the token cost for that scan, no
 *  reason to hide the result behind their auto-scan toggle.
 *
 *  Returns null until the lookup resolves; null afterwards if no scan
 *  exists. Re-runs whenever `sourceUrl` changes (e.g. SPA navigation
 *  to a different video) so the card always matches the page. */
export function useExistingScan(sourceUrl: string | null): Scan | null {
  const { user } = useAuth();
  const [scan, setScan] = useState<Scan | null>(null);

  useEffect(() => {
    if (!user || !sourceUrl) {
      setScan(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const found = await findExistingYouTubeScan(sourceUrl);
      if (cancelled) return;
      setScan(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, sourceUrl]);

  // Realtime: if a scan for this URL completes (or the verdict is
  // updated by a rescan), reflect it without making the user reopen
  // the drawer. PB's collection rules limit events to the user's own
  // records, so the source-URL filter is enough.
  useEffect(() => {
    if (!user || !sourceUrl) return;
    let unsubscribed = false;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const u = await pb.collection('scans').subscribe('*', (e) => {
          const r = e.record as unknown as Scan & { userId?: string };
          if (!r || r.userId !== user.id) return;
          if (r.sourceUrl !== sourceUrl) return;
          if (r.status !== 'done') return;
          setScan((prev) => {
            if (!prev) return r;
            return new Date(r.created) > new Date(prev.created) ? r : prev;
          });
        });
        if (unsubscribed) {
          void pb.collection('scans').unsubscribe('*');
          return;
        }
        unsub = () => {
          const result = u as unknown;
          if (typeof result === 'function') (result as () => void)();
          else void pb.collection('scans').unsubscribe('*');
        };
      } catch {
        // Realtime unavailable — initial fetch already provided the value.
      }
    })();
    return () => {
      unsubscribed = true;
      if (unsub) unsub();
    };
  }, [user, sourceUrl]);

  return scan;
}
