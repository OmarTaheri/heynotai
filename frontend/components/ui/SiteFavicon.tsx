import styles from "./SiteFavicon.module.css";

/**
 * 30×30 colored square showing a domain's letter mark — used in the
 * per-site rules list and anywhere a row needs a recognizable site
 * marker without loading actual favicons. Driven by a brand → class
 * map so call sites just pass `brand="x"` and the colors come along.
 */
export function SiteFavicon({
  brand,
  initial,
}: {
  brand: string;
  initial: string;
}) {
  const cls = BRAND_CLASS[brand] ?? styles.fallback;
  return <span className={`${styles.fav} ${cls}`} aria-hidden>{initial}</span>;
}

const BRAND_CLASS: Record<string, string> = {
  x: styles.x,
  yt: styles.yt,
  ig: styles.ig,
  rd: styles.rd,
  bbc: styles.bbc,
  li: styles.li,
  med: styles.med,
  tk: styles.tk,
};
