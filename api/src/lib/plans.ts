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

export function isPlan(value: unknown): value is Plan {
  return value === "check" || value === "verify" || value === "certify" || value === "team";
}
