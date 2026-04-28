"use client";

import { Icon } from "@/components/Icon";
import type { Plan } from "@/lib/auth";
import styles from "./UsageCard.module.css";

/** Total bars in the battery meter. Stays fixed so the visual rhythm
 *  (via per-bar heights in the module) reads consistently regardless of
 *  the user's plan size. */
const BAR_COUNT = 20;

/** Per-tier badge class — matches the extension's detection-mode colors.
 *  Keyed on Plan so a typo here is a compile error, not a visual bug. */
const TIER_CLASS: Record<Plan, string> = {
  check: styles.tierCheck,
  verify: styles.tierVerify,
  certify: styles.tierCertify,
  team: styles.tierCertify,
};

/**
 * Sidebar usage card — shows how many checks the current user still has
 * on their plan, rendered as an equalizer-style battery meter with a
 * plan badge and an "Upgrade" CTA underneath.
 *
 * Two thresholds re-tint the battery:
 *   remaining < 30%  → warn amber
 *   remaining < 10%  → strike red
 *
 * The card only makes sense while the sidebar is expanded; the Sidebar
 * module folds it away (max-height + opacity) when `.isCollapsed`.
 */
export function UsageCard({
  remaining,
  total,
  plan,
  onUpgrade,
}: {
  remaining: number;
  total: number;
  plan: Plan;
  onUpgrade?: () => void;
}) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const filledBars = Math.round(ratio * BAR_COUNT);
  const level = ratio < 0.1 ? "critical" : ratio < 0.3 ? "low" : "ok";

  return (
    <div className={styles.card} data-level={level}>
      <div className={styles.head}>
        <span className={styles.count}>
          <span className={styles.countIcon} aria-hidden>
            <Icon name="sparkle" size={14} />
          </span>
          {remaining.toLocaleString()}
        </span>
        <span className={`${styles.plan} ${TIER_CLASS[plan]}`}>{plan}</span>
      </div>

      <div className={styles.label}>checks left</div>

      <div
        className={styles.battery}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={remaining}
        aria-label={`${remaining} of ${total} checks remaining`}
      >
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const filled = i < filledBars;
          // Glow only on the last filled bar — reads as the "active" cell.
          const edge = filled && i === filledBars - 1;
          return (
            <span
              key={i}
              className={styles.bar}
              data-filled={filled}
              data-edge={edge || undefined}
            />
          );
        })}
      </div>

      <button
        type="button"
        className={styles.upgrade}
        onClick={onUpgrade}
        aria-label="Upgrade plan"
      >
        <span className={styles.upgradeIcon} aria-hidden>
          <Icon name="bolt" size={14} />
        </span>
        Upgrade Plan
      </button>
    </div>
  );
}
