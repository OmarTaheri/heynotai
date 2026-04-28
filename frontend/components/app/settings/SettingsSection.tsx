import type { ReactNode } from "react";
import styles from "./SettingsSection.module.css";

/** Section wrapper with anchor id, heading and description.
 *  Children render below — usually one or more `<Card>`s. */
export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.desc}>{description}</p>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
