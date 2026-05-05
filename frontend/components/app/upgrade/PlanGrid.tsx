"use client";

import type { Plan, PlanCycle } from "@heynotai/shared";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Icon } from "@/components/Icon";
import {
  PLANS,
  formatTokens,
  resolveCta,
  ctaCopy,
  type CtaKind,
  type PlanInfo,
} from "@/lib/plans-data";
import type { PreviewItem } from "@/lib/billing-api";
import styles from "./PlanGrid.module.css";

export type PlanCardTarget = {
  plan: Plan;
  cycle: PlanCycle;
  kind: CtaKind;
};

/**
 * Shared 4-card plan grid. Used by /app/upgrade's pick step and the
 * public /pricing page so both surfaces stay visually identical.
 *
 * The grid takes the visitor's `currentPlan` + `currentCycle` (or both
 * `null` for anonymous public-page visitors) and runs `resolveCta`
 * per card. Optional `previews` map carries proration totals for
 * existing subscribers — keys are `${plan}-${cycle}`.
 */
export function PlanGrid({
  cycle,
  currentPlan = null,
  currentCycle = null,
  pendingPlanEffective = null,
  previews,
  onPick,
  hideTeam = false,
}: {
  cycle: PlanCycle;
  currentPlan?: Plan | null;
  currentCycle?: PlanCycle | null;
  /** ISO date the active scheduled downgrade lands on, or null. Used
   *  for the "applies <date>" caption on downgrade CTAs. */
  pendingPlanEffective?: string | null;
  /** Map of "{plan}-{cycle}" → preview item. Only populated when the
   *  user has an active sub. Cards look up their own row here. */
  previews?: Map<string, PreviewItem>;
  onPick: (target: PlanCardTarget) => void;
  hideTeam?: boolean;
}) {
  const visible = hideTeam ? PLANS.filter((p) => p.id !== "team") : PLANS;
  const current =
    currentPlan !== null
      ? { plan: currentPlan, cycle: currentCycle ?? null }
      : null;
  return (
    <div className={styles.grid}>
      {visible.map((plan) => {
        const kind = resolveCta(plan.id, cycle, current);
        const monthlyEquiv =
          cycle === "yearly" && plan.yearly > 0
            ? Math.round(plan.yearly / 12)
            : plan.monthly;
        const isFree = plan.monthly === 0 && plan.yearly === 0;
        const isCustom = plan.tokensPerMonth === null;
        const previewKey = `${plan.id}-${cycle}`;
        const preview = previews?.get(previewKey);

        return (
          <Card
            key={plan.id}
            as="article"
            className={`${styles.card} ${styles[`tone-${plan.tone}`]}${plan.popular ? ` ${styles.popular}` : ""}`}
          >
            <div className={styles.head}>
              <div className={styles.nameRow}>
                <h2 className={styles.name}>{plan.name}</h2>
                {plan.popular && (
                  <Pill tone="gold" compact>
                    MOST POPULAR
                  </Pill>
                )}
              </div>
              <p className={styles.tagline}>{plan.tagline}</p>
            </div>

            <div className={styles.priceBlock}>
              {isFree ? (
                <>
                  <div className={styles.price}>
                    <span className={styles.priceNumber}>Free</span>
                  </div>
                  <div className={styles.priceBilling}>forever</div>
                </>
              ) : isCustom ? (
                <>
                  <div className={styles.price}>
                    <span className={styles.priceNumber}>Custom</span>
                  </div>
                  <div className={styles.priceBilling}>tailored to your team</div>
                </>
              ) : (
                <>
                  <div className={styles.price}>
                    <span className={styles.priceCurrency}>$</span>
                    <span className={styles.priceNumber}>{monthlyEquiv}</span>
                    <span className={styles.priceUnit}>/ mo</span>
                  </div>
                  <div className={styles.priceBilling}>
                    {cycle === "yearly"
                      ? `billed annually · $${plan.yearly} / yr`
                      : "billed monthly"}
                  </div>
                </>
              )}
            </div>

            <div className={styles.scans}>
              <span className={styles.scansNumber}>
                {formatTokens(plan.tokensPerMonth)}
              </span>
              <span className={styles.scansLabel}>tokens / month</span>
            </div>

            <PlanCta plan={plan} kind={kind} cycle={cycle} onPick={onPick} />

            <ProrationCaption
              kind={kind}
              preview={preview}
              pendingPlanEffective={pendingPlanEffective}
            />

            <ul className={styles.features}>
              {plan.features.map((f) => (
                <li key={f}>
                  <span className={styles.checkIcon} aria-hidden>
                    <Icon name="check" size={12} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function PlanCta({
  plan,
  kind,
  cycle,
  onPick,
}: {
  plan: PlanInfo;
  kind: CtaKind;
  cycle: PlanCycle;
  onPick: (target: PlanCardTarget) => void;
}) {
  const { label, variant } = ctaCopy(kind, plan.id);

  if (variant === "disabled") {
    return (
      <button type="button" className={`${styles.cta} ${styles.ctaCurrent}`} disabled>
        {label}
      </button>
    );
  }

  const variantClass =
    variant === "outline" ? styles.ctaOutline : styles.ctaSolid;
  return (
    <button
      type="button"
      className={`${styles.cta} ${variantClass}`}
      onClick={() => onPick({ plan: plan.id, cycle, kind })}
    >
      {label}
    </button>
  );
}

function ProrationCaption({
  kind,
  preview,
  pendingPlanEffective,
}: {
  kind: CtaKind;
  preview?: PreviewItem;
  pendingPlanEffective: string | null;
}) {
  // Only show captions for kinds that *can* carry a price diff.
  if (
    kind === "current" ||
    kind === "anonymous_signup" ||
    kind === "contact" ||
    kind === "cancel_to_free"
  ) {
    return null;
  }

  // Deferred (downgrade): no charge today, schedule notice instead.
  if (kind === "downgrade") {
    const dateLabel = pendingPlanEffective
      ? new Date(pendingPlanEffective).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "the end of your billing period";
    return (
      <div className={`${styles.ctaCaption} ${styles.ctaCaptionDeferred}`}>
        applies {dateLabel} · no charge today
      </div>
    );
  }

  if (!preview || preview.error) return null;

  const total = preview.totalDueToday ?? preview.sticker;
  const credit = preview.credit ?? 0;
  const symbol = preview.currency === "USD" ? "$" : "";
  const fmt = (n: number) =>
    `${symbol}${n.toFixed(2)}${preview.currency === "USD" ? "" : ` ${preview.currency}`}`;

  if (credit > 0) {
    return (
      <div className={styles.ctaCaption}>
        <strong>{fmt(total)}</strong> today
        <br />
        sticker {fmt(preview.sticker)} · {fmt(credit)} credit
      </div>
    );
  }

  return (
    <div className={styles.ctaCaption}>
      <strong>{fmt(total)}</strong> today
    </div>
  );
}
