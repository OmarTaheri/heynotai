"use client";

import { useRouter } from "next/navigation";
import { isModelLocked, type Plan } from "@heynotai/shared";
import { Icon } from "@/components/Icon";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { useAuth } from "@/lib/auth";
import {
  BADGE_LABEL,
  TIER_LABEL,
  type Engine,
  type EngineBadge,
} from "@/lib/models-data";
import { TEAM_SALES_MAILTO } from "@/lib/plans-data";
import styles from "./EngineRow.module.css";

const BADGE_TONE: Record<EngineBadge, PillTone> = {
  default: "human",
  recommended: "info",
  fast: "neutral",
  beta: "neutral",
  local: "local",
  team: "gold",
  enterprise: "gold",
};

/** Plan tiers map to dedicated accent hues: verify=teal (hue 165 via
 *  `--color-human`), certify=cobalt-blue (hue 220 via
 *  `--color-certify`), team=gold (hue 85). Free `check` rows stay
 *  neutral so the eye lands on premium options. */
const TIER_TONE: Record<Plan, PillTone | null> = {
  check: null,
  verify: "human",
  certify: "certify",
  team: "gold",
};

const TIER_CLASS: Record<Plan, string | null> = {
  check: null,
  verify: styles.tierVerify ?? null,
  certify: styles.tierCertify ?? null,
  team: styles.tierTeam ?? null,
};

/** Upgrade pill colored to match the row's tier so CTA + card read
 *  as one surface. `team` falls through to the gold default. */
const UPGRADE_CLASS: Record<Plan, string | null> = {
  check: null,
  verify: styles.upgradeVerify ?? null,
  certify: styles.upgradeCertify ?? null,
  team: null,
};

type Props = {
  engine: Engine;
  selected: boolean;
  onSelect: () => void;
};

/**
 * One engine option row. Selectable via radio + name click; rows whose
 * `tier` is above the user's plan render with a gold lock + Upgrade
 * CTA and don't toggle selection. The per-tier left border (teal /
 * violet / gold) renders on every row so users read tier from card
 * color even when unlocked.
 *
 * API keys are owner-managed in PocketBase, so users see no key/edit
 * affordances here — only the model name, accuracy, and per-scan cost.
 */
export function EngineRow({ engine, selected, onSelect }: Props) {
  const { user } = useAuth();
  const userPlan: Plan = user?.plan ?? "check";
  const locked = isModelLocked(userPlan, engine.tier);
  const router = useRouter();

  const rootClasses = [
    styles.row,
    TIER_CLASS[engine.tier],
    selected && !locked && styles.selected,
    locked && styles.locked,
  ]
    .filter(Boolean)
    .join(" ");

  const upgradeCta = engine.tier === "team" ? "Contact sales" : "Upgrade";

  const handleClick = () => {
    if (!locked) {
      onSelect();
      return;
    }
    if (upgradeCta === "Contact sales") {
      window.location.href = TEAM_SALES_MAILTO;
    } else {
      router.push("/app/upgrade");
    }
  };

  const tierTone = TIER_TONE[engine.tier];

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
            {tierTone && (
              <Pill tone={tierTone} compact>
                {TIER_LABEL[engine.tier]}
              </Pill>
            )}
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

        {locked && (
          <span className={styles.action}>
            <span
              className={[styles.upgrade, UPGRADE_CLASS[engine.tier]]
                .filter(Boolean)
                .join(" ")}
            >
              <Icon
                name={upgradeCta === "Contact sales" ? "users" : "sparkle"}
                size={11}
              />
              {upgradeCta}
            </span>
          </span>
        )}
      </button>
    </article>
  );
}
