import { Icon } from "@/components/Icon";
import type { Template } from "@/lib/reports-data";
import styles from "./TemplateCard.module.css";

/**
 * One card in the "Start from a template" grid. Tinted icon tile +
 * title + description + format note. The custom-template variant uses
 * a dashed icon tile to read as "build your own".
 */
export function TemplateCard({ template }: { template: Template }) {
  const tileClass = [
    styles.tile,
    styles[`tile_${template.tone}`],
    template.custom && styles.tile_custom,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={styles.card}>
      <span className={tileClass} aria-hidden>
        <Icon name={template.icon} size={18} />
      </span>
      <h3 className={styles.name}>{template.name}</h3>
      <p className={styles.desc}>{template.description}</p>
      <span className={styles.foot}>
        <span>{template.formatNote}</span>
        <Icon name="arrow-right" size={11} />
      </span>
    </button>
  );
}
