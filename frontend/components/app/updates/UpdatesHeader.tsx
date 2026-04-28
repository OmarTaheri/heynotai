import styles from "./UpdatesHeader.module.css";

/**
 * Editorial page header for /app/updates. Borrows the home greeting's
 * dimmed-phrase + full-fg `<em>` accent (CSS strips the italic and
 * bumps color to var(--color-fg)) so the page anchors on the same word
 * weight as the rest of the dashboard.
 */
export function UpdatesHeader({ version }: { version: string }) {
  return (
    <header className={styles.head}>
      <div className={styles.eyebrow}>Changelog · {version}</div>
      <h1 className={styles.title}>
        What&apos;s <em>new</em>
      </h1>
      <p className={styles.subtitle}>
        New models, accuracy improvements, and product changes —
        published every Tuesday. We don&apos;t pad releases. If we shipped
        something, it&apos;s here.
      </p>
    </header>
  );
}
