import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import styles from "./StatTile.module.css";

export type StatTone = "up" | "down" | "warn";

export type StatTileProps = {
  label: string;
  value: ReactNode;
  unit?: string;
  delta: ReactNode;
  tone?: StatTone;
  icon?: IconName;
};

const TONE_CLASS: Record<StatTone, string | undefined> = {
  up: undefined,
  down: styles.down,
  warn: styles.warn,
};

/**
 * Single KPI tile.
 *
 *   <StatTile label="Scans" value="1,247" delta="+18%" tone="up" />
 *
 * `value` can be a string or a React node so callers can compose
 * complex values (e.g. number + percent unit). When `unit` is passed,
 * it renders quietly to the right of the value.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  tone = "up",
  icon,
}: StatTileProps) {
  const deltaClass = [styles.delta, TONE_CLASS[tone]].filter(Boolean).join(" ");
  return (
    <article className={styles.tile}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>
        <span>{value}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      <div className={deltaClass}>
        {icon && <Icon name={icon} size={11} />}
        <span>{delta}</span>
      </div>
    </article>
  );
}

/**
 * Four-column container. Use as `<StatGrid><StatTile … /> …</StatGrid>`
 * so you don't have to remember the grid class.
 */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
