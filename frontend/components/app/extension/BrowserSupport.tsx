"use client";

import {
  BROWSERS,
  EXTENSION_STORE_URL,
  type BrowserSupport as Item,
} from "@/lib/extension-data";
import { useExtensionPresence } from "@/lib/use-extension-presence";
import styles from "./BrowserSupport.module.css";

/** Row of browser tiles — one per browser a build exists for.
 *
 *  "Installed" is decided at runtime: the tile for the browser you're
 *  actually in flips to installed (with its real version) when the
 *  content script's marker is present. Previously Chrome was hard-coded
 *  as installed on `v2.4.1` for every visitor. */
export function BrowserSupport() {
  const presence = useExtensionPresence();
  const installedVersion =
    presence.state === "installed" ? presence.version : null;
  const currentBrowser = detectBrowser();

  return (
    <div className={styles.row}>
      {BROWSERS.map((b) => (
        <BrowserTile
          key={b.id}
          item={b}
          installedVersion={
            installedVersion && b.id === currentBrowser ? installedVersion : null
          }
        />
      ))}
    </div>
  );
}

function BrowserTile({
  item,
  installedVersion,
}: {
  item: Item;
  installedVersion: string | null;
}) {
  const installed = !!installedVersion;
  const body = (
    <>
      <span className={`${styles.logo} ${styles[`hue_${item.hue}`]}`} aria-hidden>
        {item.initial}
      </span>
      <div className={styles.info}>
        <div className={styles.name}>{item.name}</div>
        <div className={styles.status}>
          {installed
            ? `Installed · v${installedVersion}`
            : item.status === "soon"
              ? "Not yet supported"
              : "Available"}
        </div>
      </div>
      {!installed && item.status === "available" && (
        <span className={styles.tag}>INSTALL</span>
      )}
      {item.status === "soon" && <span className={styles.tag}>SOON</span>}
    </>
  );

  const className = `${styles.tile} ${installed ? styles.installed : ""}`;

  // Available browsers link to the store; "soon" tiles stay inert.
  if (!installed && item.status === "available") {
    return (
      <a
        className={className}
        href={EXTENSION_STORE_URL}
        target="_blank"
        rel="noreferrer"
      >
        {body}
      </a>
    );
  }
  return <div className={className}>{body}</div>;
}

/** Coarse UA sniff, only used to decide which tile the runtime-detected
 *  install belongs to. Order matters: Edge's UA also contains "Chrome". */
function detectBrowser(): Item["id"] | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return null;
}
