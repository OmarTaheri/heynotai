"use client";

import type { MouseEvent } from "react";
import { Icon, type IconName } from "@/components/Icon";
import styles from "./Table.module.css";

/**
 * Hover-revealed row-action button. Lives in its own "use client" file
 * because it always wires up an `onClick` (to stop event bubbling so a
 * row's selection toggle doesn't fire from a menu click) — and event
 * handlers can't cross the RSC boundary.
 */
export function TableRowAction({
  onClick,
  ariaLabel = "Row actions",
  iconName = "more",
  iconSize = 14,
  className = "",
}: {
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  ariaLabel?: string;
  iconName?: IconName;
  iconSize?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.rowAction} ${className}`}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      <Icon name={iconName} size={iconSize} />
    </button>
  );
}
