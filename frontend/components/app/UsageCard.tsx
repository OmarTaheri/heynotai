"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { Plan } from "@/lib/auth";
import { TOP_PLANS } from "@/lib/plans-data";
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
 * Sidebar usage card — shows how many tokens the current user still has
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
  // Hide the upgrade affordance when the user is already on the top
  // self-serve tier (or on Team, which is contact-sales). They've got
  // nowhere to go from the picker.
  const showUpgrade = !TOP_PLANS.has(plan);

  return (
    <div className={styles.card} data-level={level}>
      <div className={styles.head}>
        <span className={styles.count}>
          <span className={styles.countIcon} aria-hidden>
            <Icon name="sparkle" size={14} />
          </span>
          {formatRemaining(remaining)}
        </span>
        <span className={`${styles.plan} ${TIER_CLASS[plan]}`}>{plan}</span>
      </div>

      <div className={styles.label}>tokens left</div>

      <div
        className={styles.battery}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={remaining}
        aria-label={`${remaining} of ${total} tokens remaining`}
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

      {showUpgrade &&
        (onUpgrade ? (
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
        ) : (
          <Link
            href="/app/upgrade"
            className={styles.upgrade}
            aria-label="Upgrade plan"
          >
            <span className={styles.upgradeIcon} aria-hidden>
              <Icon name="bolt" size={14} />
            </span>
            Upgrade Plan
          </Link>
        ))}
    </div>
  );
}

// Token counts get large fast — render millions/thousands compactly so
// they don't overflow the sidebar card. Below 10k we keep the raw
// number so the user can see exactly what's left.
function formatRemaining(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}
