import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-state';
import { backend } from '@/lib/backend';
import { listScans } from '@/lib/scans-api';
import type { Scan } from '@/lib/scans-api';

export interface LatestTextScan {
  /** Most recent finished right-click text scan, if any. */
  scan: Scan | null;
  /** A right-click text scan is running on this tab right now. */
  pending: boolean;
  /** True when `scan` is one the user just ran while this drawer was
   *  open, as opposed to one backfilled from their history. Only a
   *  live result is allowed to take over the panel from a page-level
   *  verdict — otherwise a week-old text scan would hijack the view
   *  every time the drawer opened. */
  live: boolean;
}

/** Reads the tabId the drawer was mounted for. The drawer lives in an
 *  iframe injected by the background worker, which passes the host
 *  tab's id on the query string. */
function currentTabId(): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('tabId');
    const parsed = parseInt(raw ?? '', 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

/** Tracks the right-click ("AI check this text") scan lifecycle for the
 *  drawer's Home tab: whether one is running right now, and the most
 *  recent finished one.
 *
 *  Three sources feed this, in order of latency:
 *    1. `QUERY_TEXT_SCAN` to the background worker on mount — answers
 *       "was a scan already running before I opened?", which is the
 *       case the user hits whenever they right-click first and open the
 *       drawer second.
 *    2. `TEXT_SCAN_*` broadcasts from the worker while the drawer is
 *       open — these carry the finished scan record directly, so the
 *       result lands without waiting on realtime.
 *    3. A backfill fetch + realtime subscription, so a scan finished in
 *       another tab (or before this drawer existed) still shows up. */
export function useLatestTextScan(): LatestTextScan {
  const { user } = useAuth();
  const [scan, setScan] = useState<Scan | null>(null);
  const [pending, setPending] = useState(false);
  const [live, setLive] = useState(false);

  // ── 1 + 2: worker-driven lifecycle ───────────────────────────────
  useEffect(() => {
    const myTabId = currentTabId();

    if (myTabId != null) {
      try {
        void chrome.runtime
          .sendMessage({ type: 'QUERY_TEXT_SCAN', tabId: myTabId })
          .then((response: unknown) => {
            const r = response as { scanning?: boolean } | undefined;
            if (r?.scanning) setPending(true);
          })
          .catch(() => {
            // Worker asleep or no handler — the idle UI is the right
            // fallback here.
          });
      } catch {}
    }

    const onMessage = (raw: unknown) => {
      const msg = raw as
        | { type?: string; tabId?: number; scan?: Scan }
        | null;
      if (!msg?.type?.startsWith('TEXT_')) return;
      // Lifecycle events are tagged with the tab they belong to, so a
      // scan running in another tab can't take over this drawer.
      if (myTabId != null && msg.tabId != null && msg.tabId !== myTabId) return;

      if (msg.type === 'TEXT_SCAN_STARTED') {
        // Drop the previous verdict — leaving it on screen next to a
        // spinner reads as "this is the result", which it isn't.
        setScan(null);
        setLive(false);
        setPending(true);
      } else if (msg.type === 'TEXT_SCAN_COMPLETE') {
        setPending(false);
        if (msg.scan) {
          setScan(msg.scan);
          setLive(true);
        }
      } else if (
        msg.type === 'TEXT_SCAN_FAILED' ||
        msg.type === 'TEXT_AI_CHECK_AUTH_REQUIRED'
      ) {
        // The in-page pill explains the failure; the drawer just stops
        // claiming that something is still running.
        setPending(false);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  // ── 3: backfill the most recent finished scan ────────────────────
  useEffect(() => {
    if (!user) {
      setScan(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const page = await listScans({ perPage: 1, type: 'txt', origin: 'ext' });
        if (cancelled) return;
        const first = page.items[0];
        if (first && first.status === 'done') {
          // Never clobber a fresher record already delivered by the
          // worker broadcast, which can beat this fetch.
          setScan((prev) => (prev ? prev : first));
        }
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
        const u = await backend.collection('scans').subscribe('*', (e) => {
          const r = e.record as unknown as Scan & { userId?: string };
          if (!r || r.userId !== user.id) return;
          if (r.origin !== 'ext' || r.type !== 'txt') return;
          if (r.status !== 'done') return;
          setPending(false);
          setScan((prev) => {
            if (!prev) return r;
            return new Date(r.created) > new Date(prev.created) ? r : prev;
          });
        });
        if (unsubscribed) {
          void backend.collection('scans').unsubscribe('*');
          return;
        }
        unsub = () => {
          // The subscribe callback returns a function in the backend SDK
          // that unsubs only this listener. Defensive cast for older
          // SDK versions where the return type is `Promise<void>`.
          const result = u as unknown;
          if (typeof result === 'function') (result as () => void)();
          else void backend.collection('scans').unsubscribe('*');
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

  return { scan, pending, live };
}
