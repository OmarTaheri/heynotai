"use client";

import { useEffect, useState } from "react";
import { subscribeScans } from "./scans-api";
import { pb } from "./pocketbase";

/** Returns a counter that bumps on every PB realtime event in the
 *  user's `scans` collection. Pages add this to their data-fetching
 *  effect's dependency array so an in-flight scan started from the
 *  extension flips status (queued → scanning → done) live, without
 *  the page needing to mirror the merge logic itself.
 *
 *  Pattern matches `useExtensionPrefs` — we resubscribe on auth
 *  change so signing in/out doesn't leave a dead websocket. */
export function useScansRealtime(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

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
          // Auth missing or transient PB error — leave tick alone so
          // the page just relies on its initial fetch.
        });
    };

    if (pb.authStore.isValid) start();

    const offAuth = pb.authStore.onChange(() => {
      unsub?.();
      unsub = null;
      if (pb.authStore.isValid) start();
    });

    return () => {
      cancelled = true;
      unsub?.();
      offAuth();
    };
  }, []);

  return tick;
}
