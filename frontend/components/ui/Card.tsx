import type { ReactNode, HTMLAttributes } from "react";
import styles from "./Card.module.css";

/**
 * Generic bordered surface.
 *
 *   <Card padded>{...}</Card>
 *
 * `padded` adds the standard 16/18 inset; opt out when the card hosts a
 * full-bleed table or split body (like the last-scan card). `elevated`
 * adds the soft drop-shadow when the surface should pop off the bg.
 */
export function Card({
  children,
  padded,
  elevated,
  className = "",
  as = "section",
  ...rest
}: {
  children: ReactNode;
  padded?: boolean;
  elevated?: boolean;
  className?: string;
  as?: "section" | "article" | "div" | "aside";
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
  const Tag = as;
  const classes = [
    styles.card,
    padded && styles.padded,
    elevated && styles.elevated,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
