"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { StatusPulse } from "@/components/ui/StatusPulse";
import { EXTENSION_STORE_URL } from "@/lib/extension-data";
import { useExtensionPresence } from "@/lib/use-extension-presence";
import { fetchHomeStats } from "@/lib/stats-api";
import { useAuth } from "@/lib/auth";
import styles from "./StatusHero.module.css";

/** Status card at the top of /app/extension.
 *
 *  Everything here is measured, not asserted. Install state and version
 *  come from the marker the content script stamps on `<html>`; the scan
 *  count comes from `/me/stats`. The card previously rendered a fixed
 *  "Active · synced 12 seconds ago · v2.4.1 · 298 scans last 7 days ·
 *  Installed Aug 14, 2025" even in a browser with nothing installed. */
export function StatusHero() {
  const presence = useExtensionPresence();
  const scans7d = useScansLast7Days();
  const installed = presence.state === "installed";
  const checking = presence.state === "checking";

  return (
    <section className={styles.hero}>
      <div className={styles.icon} aria-hidden>
        <span className={styles.iconMark}>D</span>
      </div>

      <div className={styles.info}>
        <div className={styles.statusRow}>
          <StatusPulse tone={installed ? "ok" : checking ? "info" : "warn"} />
          <span className={styles.statusTxt}>
            {checking
              ? "Looking for the extension…"
              : installed
                ? "Active in this browser"
                : "Not detected in this browser"}
          </span>
        </div>
        <h2 className={styles.title}>
          heynotai for <span className={styles.titleAccent}>your browser</span>
        </h2>
        <ul className={styles.meta}>
          {installed && (
            <>
              <li>
                Version <strong>{presence.version}</strong>
              </li>
              <li className={styles.dot} aria-hidden />
            </>
          )}
          <li>
            <strong>{scans7d === null ? "—" : scans7d}</strong> scans last 7 days
          </li>
          {!installed && !checking && (
            <>
              <li className={styles.dot} aria-hidden />
              <li>Install it to scan pages as you browse</li>
            </>
          )}
        </ul>
      </div>

      <div className={styles.actions}>
        {/* Settings below still save to your account whether or not this
            browser has the extension — they sync on next launch. There is
            no "reload extension" action: a web page cannot reload an
            installed extension, so that button never did anything. */}
        <Button variant="secondary" href="/install">
          <Icon name="info" size={13} />
          Setup guide
        </Button>
        <Button
          variant={installed ? "secondary" : "primary"}
          href={EXTENSION_STORE_URL}
        >
          <Icon name="upload" size={13} />
          {installed ? "Open store listing" : "Get the extension"}
        </Button>
      </div>
    </section>
  );
}

/** Rolling 7-day scan count from `/me/stats`. `null` while loading or
 *  when the request fails, which renders as an em-dash. */
function useScansLast7Days(): number | null {
  const { user } = useAuth();
  const userId = user?.id;
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) {
      setCount(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const stats = await fetchHomeStats().catch(() => null);
      if (cancelled || !stats) return;
      setCount(stats.scansLast7Days ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return count;
}
