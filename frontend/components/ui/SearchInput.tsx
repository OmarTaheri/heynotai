import type { InputHTMLAttributes } from "react";
import { Icon } from "@/components/Icon";
import styles from "./SearchInput.module.css";

/**
 * Search field with leading magnifier icon. Sized to sit alongside .btn
 * controls in toolbars (collections, library filter bars, future
 * reports/models pages).
 */
export function SearchInput({
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={`${styles.wrap} ${className}`}>
      <Icon name="search" size={14} />
      <input type="search" className={styles.input} {...rest} />
    </label>
  );
}
