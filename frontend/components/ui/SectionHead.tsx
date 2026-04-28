import Link from "next/link";
import { Icon } from "@/components/Icon";
import styles from "./SectionHead.module.css";

/**
 * Section heading row — title (and optional muted subtitle) on the
 * left, optional link on the right. Used above lists, tables, and
 * detail cards inside dashboard pages.
 */
export function SectionHead({
  title,
  subtitle,
  linkLabel,
  linkHref,
}: {
  title: string;
  subtitle?: string;
  linkLabel?: string;
  linkHref?: string;
}) {
  return (
    <div className={styles.head}>
      <h2 className={styles.title}>
        <span>{title}</span>
        {subtitle && <span className={styles.subtitle}>· {subtitle}</span>}
      </h2>
      {linkLabel && linkHref && (
        <Link href={linkHref} className={styles.link}>
          {linkLabel}
          <Icon name="chevron-right" size={12} />
        </Link>
      )}
    </div>
  );
}
