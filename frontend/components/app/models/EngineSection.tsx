"use client";

import { isModelLocked, type Plan } from "@heynotai/shared";
import { useAuth } from "@/lib/auth";
import {
  TYPE_LABEL,
  type Engine,
  type EngineType,
} from "@/lib/models-data";
import { EngineRow } from "./EngineRow";
import styles from "./EngineSection.module.css";

type Props = {
  type: EngineType;
  engines: Engine[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/**
 * Heading + list of engines for a single content type. Counts at the
 * top right summarize how many rows are selectable vs. locked, matching
 * the mockup's "1 selected · 4 available · 2 locked" pattern.
 */
export function EngineSection({ type, engines, selectedId, onSelect }: Props) {
  const { user } = useAuth();
  const userPlan: Plan = user?.plan ?? "check";
  const lockedCount = engines.filter((e) => isModelLocked(userPlan, e.tier)).length;
  const availableCount = engines.length - lockedCount;

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.title}>{TYPE_LABEL[type]} engines</h2>
        <div className={styles.meta}>
          <span>
            <strong>1</strong> selected
          </span>
          <span className={styles.dot} aria-hidden />
          <span>
            {availableCount} available
            {lockedCount > 0 && ` · ${lockedCount} locked`}
          </span>
        </div>
      </header>

      <div className={styles.list}>
        {engines.map((engine) => (
          <EngineRow
            key={engine.id}
            engine={engine}
            selected={engine.id === selectedId}
            onSelect={() => onSelect(engine.id)}
          />
        ))}
      </div>
    </section>
  );
}
