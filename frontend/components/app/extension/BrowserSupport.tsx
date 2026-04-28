import { BROWSERS, type BrowserSupport as Item } from "@/lib/extension-data";
import styles from "./BrowserSupport.module.css";

/** Row of browser tiles — one per supported browser, with the
 *  installed one styled differently. Each available browser links
 *  to its install page; "soon" tiles render a non-interactive tag. */
export function BrowserSupport() {
  return (
    <div className={styles.row}>
      {BROWSERS.map((b) => <BrowserTile key={b.id} item={b} />)}
    </div>
  );
}

function BrowserTile({ item }: { item: Item }) {
  return (
    <div
      className={`${styles.tile} ${item.status === "installed" ? styles.installed : ""}`}
    >
      <span className={`${styles.logo} ${styles[`hue_${item.hue}`]}`} aria-hidden>
        {item.initial}
      </span>
      <div className={styles.info}>
        <div className={styles.name}>{item.name}</div>
        <div className={styles.status}>
          {item.status === "installed" && `Installed · ${item.version ?? ""}`.trim()}
          {item.status === "available" && "Available"}
          {item.status === "soon" && "Coming Q3"}
        </div>
      </div>
      {item.status === "available" && <span className={styles.tag}>INSTALL</span>}
      {item.status === "soon" && <span className={styles.tag}>SOON</span>}
    </div>
  );
}
