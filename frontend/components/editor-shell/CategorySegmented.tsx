import styles from "./CategorySegmented.module.css";

export interface SegmentItem<K extends string> {
  key: K;
  label: string;
  swatch?: string;
}

interface Props<K extends string> {
  items: SegmentItem<K>[];
  value: K | "all";
  onChange: (next: K | "all") => void;
  ariaLabel?: string;
}

/**
 * Generic 2–4 segment pill control. Used for the AI/Match/Plagiarism
 * filter today; reusable for any editor's category segmenting.
 */
export function CategorySegmented<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: Props<K>) {
  return (
    <div
      className={styles.seg}
      role="tablist"
      aria-label={ariaLabel}
      style={{ ["--seg-cols" as string]: items.length }}
    >
      {items.map((item) => {
        const active =
          value === item.key || (value === "all" && item.key === items[0].key);
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.btn}${active ? ` ${styles.btnActive}` : ""}`}
            onClick={() => onChange(value === item.key ? "all" : item.key)}
          >
            {item.swatch && (
              <span
                className={styles.swatch}
                style={{ background: item.swatch }}
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
