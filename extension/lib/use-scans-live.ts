import { useEffect, useRef, useState } from 'react';
import {
  listScans,
  subscribeScans,
  ScanApiError,
  type Scan,
} from './scans-api';
import { pb } from './pocketbase';

interface UseScansLive {
  scans: Scan[];
  totalItems: number;
  loading: boolean;
  /** 'auth' = user signed out / never signed in. `Content.tsx` falls
   *  back to the mock CONTENT_ITEMS preview in that case. 'fetch' =
   *  network/server error. null = no error. */
  error: 'auth' | 'fetch' | null;
  refresh: () => void;
}

/** Live scans list. Fetches the first page on mount + every auth
 *  change, and re-fetches whenever PB realtime reports any
 *  create/update/delete in the user's `scans` collection. The drawer's
 *  Content tab and (eventually) the website's library page share the
 *  same shape so a YouTube scan started anywhere flips to a working
 *  pill on every open surface within ~1 realtime tick.
 *
 *  We re-fetch instead of patching the local list because the API
 *  normalizes records (engineId → model, JSON parsing, etc.) — easier
 *  to stay correct than to mirror that logic on every event.  */
export function useScansLive(perPage: number): UseScansLive {
  const [scans, setScans] = useState<Scan[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'auth' | 'fetch' | null>(null);
  // Bumped on every realtime tick + manual refresh; the fetch effect
  // keys off it so we don't re-create subscriptions on every reload.
  const [tick, setTick] = useState(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    if (!pb.authStore.isValid) {
      setScans([]);
      setTotalItems(0);
      setLoading(false);
      setError('auth');
      return () => {
        cancelRef.current = true;
      };
    }

    setLoading((prev) => prev && true);
    setError(null);
    void (async () => {
      try {
        const page = await listScans({ perPage });
        if (cancelRef.current) return;
        setScans(page.items);
        setTotalItems(page.totalItems);
        setLoading(false);
      } catch (err) {
        if (cancelRef.current) return;
        setLoading(false);
        if (err instanceof ScanApiError && err.status === 401) {
          setError('auth');
          setScans([]);
          setTotalItems(0);
        } else {
          setError('fetch');
        }
      }
    })();

    return () => {
      cancelRef.current = true;
    };
  }, [perPage, tick]);

  // Realtime sub — independent of the fetch effect so a refresh tick
  // doesn't tear down + recreate the websocket. Auth-gated: PB
  // realtime only delivers events the auth context can read, so
  // subscribing while signed out just produces an erroring SSE.
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    const start = () => {
      void subscribeScans(() => {
        if (cancelled) return;
        setTick((n) => n + 1);
      })
        .then((u) => {
          if (cancelled) {
            u();
            return;
          }
          unsub = u;
        })
        .catch(() => {
          // SSE/CORS issues from the chrome-extension:// origin show up
          // as a rejected promise here. The runtime.onMessage fallback
          // below keeps the Content tab fresh either way.
        });
    };

    if (pb.authStore.isValid) start();

    const offAuth = pb.authStore.onChange(() => {
      unsub?.();
      unsub = null;
      if (pb.authStore.isValid) start();
      setTick((n) => n + 1);
    });

    return () => {
      cancelled = true;
      unsub?.();
      offAuth();
    };
  }, []);

  // Runtime-message fallback — PB realtime is unreliable from the
  // drawer iframe (chrome-extension:// origin → SSE/CORS quirks), so
  // also refetch whenever the background SW broadcasts that a scan
  // has completed. SCAN_COMPLETE is fired for YouTube auto-scans;
  // TEXT_SCAN_COMPLETE for the right-click "AI check this text" flow.
  // This is the load-bearing path for "scan finishes → drawer row
  // appears" without requiring the user to reopen the drawer.
  useEffect(() => {
    const onMessage = (msg: unknown) => {
      const t = (msg as { type?: string } | null)?.type;
      if (t === 'SCAN_COMPLETE' || t === 'TEXT_SCAN_COMPLETE') {
        setTick((n) => n + 1);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  return {
    scans,
    totalItems,
    loading,
    error,
    refresh: () => setTick((n) => n + 1),
  };
}
