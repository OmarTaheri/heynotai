import styles from "./UpgradeHeader.module.css";

/**
 * Editorial header for the plan-comparison surfaces (/app/upgrade pick
 * step + /pricing). Same eyebrow + dimmed-h1 + `<em>` reset pattern as
 * UpdatesHeader so the two pages read as one product.
 */
export function UpgradeHeader({
  eyebrow = "Pricing · Three plans",
  title,
  subtitle,
}: {
  eyebrow?: string;
  /** May contain literal `<em>…</em>` markup; the CSS resets the italic
   *  to non-italic full-fg so the `<em>` word reads as the focal point. */
  title: string;
  subtitle?: string;
}) {
  return (
    <header className={styles.head}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h1
        className={styles.title}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </header>
  );
}
