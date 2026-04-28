import Link from "next/link";
import { Fragment } from "react";
import { Icon } from "@/components/Icon";
import styles from "./Breadcrumb.module.css";

export type Crumb = { label: string; href?: string };

/**
 * Mono-styled breadcrumb trail. Last item has no `href` and renders
 * as plain text. Sized to sit above the page title in a detail view.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className={styles.bc} aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {item.href && !last ? (
              <Link href={item.href} className={styles.link}>
                {item.label}
              </Link>
            ) : (
              <span className={styles.current} aria-current={last ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {!last && (
              <Icon
                name="chevron-right"
                size={11}
                className={styles.sep}
                aria-hidden
              />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
