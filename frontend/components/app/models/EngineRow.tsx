"use client";

import { Icon } from "@/components/Icon";
import { Pill, type PillTone } from "@/components/ui/Pill";
import {
  BADGE_LABEL,
  type Engine,
  type EngineBadge,
} from "@/lib/models-data";
import styles from "./EngineRow.module.css";

const BADGE_TONE: Record<EngineBadge, PillTone> = {
  default: "human",
  recommended: "info",
  fast: "neutral",
  beta: "neutral",
  byok: "byok",
  local: "local",
  team: "gold",
  enterprise: "gold",
};

type Props = {
  engine: Engine;
  selected: boolean;
  onSelect: () => void;
};

/**
 * One engine option row. Selectable via radio + name click; locked rows
 * present a gold lock + upgrade CTA instead and don't toggle selection.
 * BYOK engines render a sunken status strip beneath the row body when
 * `engine.byok` is set.
 */
export function EngineRow({ engine, selected, onSelect }: Props) {
  const locked = !!engine.locked;

  const rootClasses = [
    styles.row,
    selected && !locked && styles.selected,
    locked && styles.locked,
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => {
    if (!locked) onSelect();
  };

  return (
    <article className={rootClasses}>
      <button
        type="button"
        className={styles.body}
        onClick={handleClick}
        aria-pressed={!locked && selected}
        aria-disabled={locked}
      >
        <span className={styles.radio} aria-hidden>
          {locked ? (
            <Icon name="lock" size={11} />
          ) : selected ? (
            <span className={styles.radioDot} />
          ) : null}
        </span>

        <span className={styles.info}>
          <span className={styles.name}>
            <span className={styles.nameText}>
              {engine.name}
              {engine.version && (
                <em className={styles.version}> {engine.version}</em>
              )}
            </span>
            {engine.badges.map((b) => (
              <Pill key={b} tone={BADGE_TONE[b]} compact>
                {BADGE_LABEL[b]}
              </Pill>
            ))}
          </span>
          <span className={styles.desc}>{engine.description}</span>
        </span>

        <span className={styles.spec}>
          <span
            className={`${styles.specValue} ${
              engine.accuracy < 90 ? styles.specWarn : ""
            }`}
          >
            {engine.accuracy}
            <span className={styles.specUnit}>%</span>
          </span>
          <span className={styles.specLabel}>Accuracy</span>
        </span>

        <span className={styles.cost}>
          <span
            className={`${styles.costValue} ${
              engine.cost.tone === "free" ? styles.costFree : ""
            } ${engine.cost.tone === "high" ? styles.costHigh : ""}`}
          >
            {engine.cost.value}
            <span className={styles.costUnit}>tk</span>
          </span>
          <span className={styles.costLabel}>{engine.cost.unit}</span>
        </span>

        <span className={styles.action}>
          {locked ? (
            <span className={styles.upgrade}>
              <Icon
                name={engine.locked!.cta === "Contact sales" ? "users" : "sparkle"}
                size={11}
              />
              {engine.locked!.cta}
            </span>
          ) : (
            <span className={styles.config} aria-label="Configure engine">
              <Icon name="settings" size={13} />
            </span>
          )}
        </span>
      </button>

      {engine.byok && !locked && (
        <div className={styles.byok}>
          <span className={styles.byokDot} aria-hidden />
          <span className={styles.byokText}>{engine.byok.statusText}</span>
          <button type="button" className={styles.byokAction}>
            <Icon name="key" size={11} />
            Update key
          </button>
        </div>
      )}
    </article>
  );
}
