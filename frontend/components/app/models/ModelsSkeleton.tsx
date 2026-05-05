import styles from "./ModelsSkeleton.module.css";

/**
 * Loading state for /app/models. Renders a heading-strip + meta-line
 * placeholder followed by four EngineRow-shaped rows so the page
 * doesn't pop when the catalog mounts. Replaces the previous
 * "no skeleton" gap on this surface.
 */
export function ModelsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <section aria-hidden role="status">
      <div className={styles.head}>
        <div className={styles.title} />
        <div className={styles.meta} />
      </div>
      <div className={styles.list}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={styles.row}>
            <div className={styles.radio} />
            <div className={styles.info}>
              <div className={styles.name} />
              <div className={styles.desc} />
            </div>
            <div className={styles.spec} />
            <div className={styles.cost} />
            <div className={styles.action} />
          </div>
        ))}
      </div>
    </section>
  );
}
