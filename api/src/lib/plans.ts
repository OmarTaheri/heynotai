import { env } from "../env.js";

/** Plans the upgrade flow can charge for. `team` is intentionally
 *  excluded — it's an admin-provisioned account type with a custom
 *  token allotment, not a self-serve tier. */
export const CHARGEABLE_PLANS = ["verify", "certify"] as const;
export type ChargeablePlan = (typeof CHARGEABLE_PLANS)[number];

export type PlanCycle = "monthly" | "yearly";

export function priceIdFor(plan: ChargeablePlan, cycle: PlanCycle): string | null {
  const map: Record<ChargeablePlan, Record<PlanCycle, string | undefined>> = {
    verify: {
      monthly: env.STRIPE_PRICE_VERIFY_MONTHLY,
      yearly: env.STRIPE_PRICE_VERIFY_YEARLY,
    },
    certify: {
      monthly: env.STRIPE_PRICE_CERTIFY_MONTHLY,
      yearly: env.STRIPE_PRICE_CERTIFY_YEARLY,
    },
  };
  return map[plan][cycle] || null;
}

export function isChargeablePlan(plan: string): plan is ChargeablePlan {
  return CHARGEABLE_PLANS.includes(plan as ChargeablePlan);
}

/** All plan tiers a user can be on. Mirrors the `users.plan` PB enum
 *  and `frontend/lib/plans-data.ts`. */
export type Plan = "check" | "verify" | "certify" | "team";

/** Monthly token budget per plan. Mirrors `tokensPerMonth` in
 *  frontend/lib/plans-data.ts so the API doesn't reach across the
 *  workspace. `team` is null — admin-assigned per account, no canonical
 *  number to gate on. */
export const PLAN_TOKEN_LIMITS: Record<Plan, number | null> = {
  check: 100,
  verify: 10_000,
  certify: 50_000,
  team: null,
};

/** Ordinal rank used to compare a `detection_models.tier` value
 *  against the caller's plan. Mirrors `PLAN_RANK` in
 *  `shared/src/index.ts`. */
export const PLAN_RANK: Record<Plan, number> = {
  check: 0,
  verify: 1,
  certify: 2,
  team: 3,
};

export function isPlan(value: unknown): value is Plan {
  return value === "check" || value === "verify" || value === "certify" || value === "team";
}

/** Coerce a raw `detection_models` row into a canonical tier. Reads
 *  `tier` first; falls back to deriving the lowest plan listed in the
 *  legacy `plansAllowed` array so un-migrated rows stay reachable.
 *  Defaults to `"check"` (most permissive) when neither is present. */
export function tierFromRow(row: {
  tier?: unknown;
  plansAllowed?: unknown;
}): Plan {
  if (isPlan(row.tier)) return row.tier;
  if (Array.isArray(row.plansAllowed)) {
    const plans = row.plansAllowed.filter(isPlan) as Plan[];
    if (plans.length > 0) {
      return plans.reduce((min, p) => (PLAN_RANK[p] < PLAN_RANK[min] ? p : min));
    }
  }
  return "check";
}
