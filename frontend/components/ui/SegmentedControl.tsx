import styles from "./SegmentedControl.module.css";

/**
 * Pill-style multi-button picker. Used by the Density toggle in
 * Settings; generic enough for any 2–5 option mutually exclusive
 * choice.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div
      className={styles.wrap}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`${styles.seg} ${active ? styles.active : ""}`}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
