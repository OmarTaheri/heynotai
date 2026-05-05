"use client";

import { useEffect, useRef, useState } from "react";
import { ClientResponseError, type RecordModel } from "pocketbase";
import { pb } from "./pocketbase";
import { useAuth } from "./auth";

type PresenceRow = RecordModel & {
  userId: string;
  scanId: string;
  lastSeen: string;
};

const HEARTBEAT_MS = 15_000;
const ACTIVE_WINDOW_MS = 35_000; // one missed heartbeat tolerance
const STALE_CHECK_MS = 5_000;

/** Tracks which users are currently viewing the given scan. The hook
 *  upserts a `presence` row every 15s while the tab is visible and the
 *  user is signed in, subscribes to realtime so other clients pop into
 *  the set within ~1s, and prunes anyone who hasn't checked in for ~35s
 *  so dropped tabs disappear without a server-side cleanup job.
 *
 *  Pass `null` for `scanId` (e.g. the synthetic /editor draft route) and
 *  the hook becomes a no-op. */
export function useScanPresence(scanId: string | null): {
  activeIds: Set<string>;
} {
  const { user } = useAuth();
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set());

  const lastSeenRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user) {
      lastSeenRef.current.clear();
      setActiveIds(new Set());
      return;
    }
    if (!scanId) {
      // Draft scan (no PB id yet) — no realtime, but the local user is
      // still "here" so the avatar stack renders something sensible.
      lastSeenRef.current.clear();
      setActiveIds(new Set([user.id]));
      return;
    }

    // Eagerly mark self as active so the avatar stack renders the
    // current user on the very first paint — without this the seed
    // fetch + first heartbeat introduce a visible "no one here" flash.
    lastSeenRef.current.set(user.id, Date.now());
    setActiveIds(new Set([user.id]));

    let cancelled = false;
    let myRowId: string | null = null;
    let unsub: (() => void) | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let staleTimer: ReturnType<typeof setInterval> | null = null;

    const recompute = () => {
      const cutoff = Date.now() - ACTIVE_WINDOW_MS;
      const next = new Set<string>();
      for (const [uid, ts] of lastSeenRef.current) {
        if (ts >= cutoff) next.add(uid);
      }
      // Always include self when the tab is visible — we may have a row
      // pending creation, and dropping ourselves between heartbeats is
      // jarring for the local UI.
      if (!document.hidden) next.add(user.id);
      setActiveIds((prev) => (sameSet(prev, next) ? prev : next));
    };

    const heartbeat = async () => {
      if (cancelled) return;
      if (document.hidden) return;
      try {
        if (myRowId) {
          await pb.collection("presence").update<PresenceRow>(
            myRowId,
            { userId: user.id, scanId },
            { requestKey: null },
          );
        } else {
          const row = await pb
            .collection("presence")
            .create<PresenceRow>(
              { userId: user.id, scanId },
              { requestKey: null },
            );
          myRowId = row.id;
        }
        lastSeenRef.current.set(user.id, Date.now());
        recompute();
      } catch (err) {
        // If create collided with a stale row from a previous tab, look
        // it up and switch to update mode. PB returns 400 on unique-index
        // violation; we don't bother decoding the body and just attempt
        // a recovery fetch.
        if (err instanceof ClientResponseError && err.status === 400 && !myRowId) {
          try {
            const existing = await pb
              .collection("presence")
              .getFirstListItem<PresenceRow>(
                pb.filter("userId = {:uid} && scanId = {:sid}", {
                  uid: user.id,
                  sid: scanId,
                }),
                { requestKey: null },
              );
            myRowId = existing.id;
          } catch {
            // Give up on this tick; we'll try again on the next heartbeat.
          }
        }
      }
    };

    const seed = async () => {
      try {
        const rows = await pb
          .collection("presence")
          .getFullList<PresenceRow>({
            filter: pb.filter("scanId = {:sid}", { sid: scanId }),
            requestKey: null,
          });
        if (cancelled) return;
        for (const row of rows) {
          lastSeenRef.current.set(
            row.userId,
            Date.parse(row.lastSeen) || Date.now(),
          );
          if (row.userId === user.id) myRowId = row.id;
        }
        recompute();
      } catch {
        // Permission errors render an empty stack — acceptable for a
        // cosmetic feature.
      }
    };

    const onEvent = (event: { action: string; record: PresenceRow }) => {
      if (event.record.scanId !== scanId) return;
      if (event.action === "delete") {
        lastSeenRef.current.delete(event.record.userId);
      } else {
        lastSeenRef.current.set(
          event.record.userId,
          Date.parse(event.record.lastSeen) || Date.now(),
        );
      }
      recompute();
    };

    const onVisibility = () => {
      if (document.hidden) return;
      void heartbeat();
    };

    void (async () => {
      await seed();
      if (cancelled) return;
      void heartbeat();
      heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_MS);
      staleTimer = setInterval(recompute, STALE_CHECK_MS);
      try {
        unsub = await pb
          .collection("presence")
          .subscribe<PresenceRow>("*", onEvent);
      } catch {
        // Realtime disabled / unauthenticated — initial fetch + local
        // heartbeat still yields a working (if static) display.
      }
    })();

    document.addEventListener("visibilitychange", onVisibility);

    const cleanup = () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (staleTimer) clearInterval(staleTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      unsub?.();
      // Best-effort delete; on hard navigations the request may not
      // complete, but the stale-prune cutoff handles that case for
      // viewers on other tabs.
      if (myRowId) {
        void pb
          .collection("presence")
          .delete(myRowId, { requestKey: null })
          .catch(() => undefined);
      }
    };

    window.addEventListener("beforeunload", cleanup);

    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, [scanId, user]);

  return { activeIds };
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
