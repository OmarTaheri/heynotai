import type { ButtonHTMLAttributes } from "react";
import { Icon } from "@/components/Icon";
import styles from "./FilterChip.module.css";

/**
 * Dropdown-style filter chip for toolbars (filter bars on Reports,
 * Library, future Collections). Renders as a button so the parent owns
 * open/close + value state — this primitive is presentational only.
 *
 *   <FilterChip label="Status" value="all" active onClick={…} />
 */
export function FilterChip({
  label,
  value,
  active,
  className = "",
  ...rest
}: {
  label: string;
  value?: string;
  active?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  const classes = [styles.chip, active && styles.active, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      <span className={styles.label}>{label}</span>
      {value && <span className={styles.value}>{value}</span>}
      <Icon name="chevron-down" size={11} />
    </button>
  );
}
