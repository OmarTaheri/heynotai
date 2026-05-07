import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-state';
import { pb } from '@/lib/pocketbase';
import { listScans } from '@/lib/scans-api';
import type { Scan } from '@/lib/scans-api';

/** Subscribes to the scans collection and returns the most recent
 *  text-selection scan (origin='ext', type='txt', status='done') for
 *  the current user. Powers the "Latest text check" card so a scan
 *  triggered via the right-click context menu surfaces in Home the
 *  next time the drawer opens. */
export function useLatestTextScan(): Scan | null {
  const { user } = useAuth();
  const [scan, setScan] = useState<Scan | null>(null);

  useEffect(() => {
    if (!user) {
      setScan(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Fetch the most recent done text scan as the initial state.
        const page = await listScans({ perPage: 1, type: 'txt', origin: 'ext' });
        if (cancelled) return;
        const first = page.items[0];
        if (first && first.status === 'done') setScan(first);
      } catch {
        // Best-effort — silent failure leaves the card hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let unsubscribed = false;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const u = await pb.collection('scans').subscribe('*', (e) => {
          const r = e.record as unknown as Scan & { userId?: string };
          if (!r || r.userId !== user.id) return;
          if (r.origin !== 'ext' || r.type !== 'txt') return;
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
          // The subscribe callback returns a function in the PB SDK
          // that unsubs only this listener. Defensive cast for older
          // SDK versions where the return type is `Promise<void>`.
          const result = u as unknown;
          if (typeof result === 'function') (result as () => void)();
          else void pb.collection('scans').unsubscribe('*');
        };
      } catch {
        /* realtime unavailable — fall back to the initial fetch */
      }
    })();
    return () => {
      unsubscribed = true;
      if (unsub) unsub();
    };
  }, [user]);

  return scan;
}
