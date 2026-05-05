import type { Plan, PlanCycle } from "@heynotai/shared";
import { PLAN_PRICES } from "@heynotai/shared";

/* Single source of truth for the plan-comparison surfaces. Consumed by
 * /app/upgrade (the in-app picker step) and /pricing (the public page).
 * Prices come from `@heynotai/shared` so they don't drift between the
 * frontend and the API. Copy is AI-detection-flavored to match the rest
 * of the dashboard (home greeting, /app/updates header). */

export type PlanTone = "neutral" | "cta" | "gold" | "accent";

export interface PlanInfo {
  id: Plan;
  name: string;
  /** One-liner shown under the plan name. */
  tagline: string;
  /** Drives the badge color + the muted accent ring. Maps onto existing
   *  token families — no new tokens are introduced. */
  tone: PlanTone;
  /** Highlighted card. `verify` is "Most popular". */
  popular?: boolean;
  /** Monthly token budget. One token ≈ one model token spent across
   *  text/image/audio/video detection — the canonical billing unit
   *  shared with the extension's stats panel. The sidebar UsageCard
   *  reads this to render the meter without re-deriving the limit.
   *  `null` means "custom, admin-assigned" (Team plan): we render
   *  "Custom" instead of a number, and the sidebar meter is hidden. */
  tokensPerMonth: number | null;
  /** Bulleted feature list shown on each card. */
  features: string[];
  monthly: number;
  yearly: number;
}

export const PLANS: PlanInfo[] = [
  {
    id: "check",
    name: "Check",
    tagline: "A second opinion on any text, image, or clip.",
    tone: "neutral",
    tokensPerMonth: 100,
    monthly: PLAN_PRICES.check.monthly,
    yearly: PLAN_PRICES.check.yearly,
    features: [
      "AI text + image detection",
      "Confidence score with sentence-level highlights",
      "Re-scan free when a new model lands",
    ],
  },
  {
    id: "verify",
    name: "Verify",
    tagline: "Daily detection for writers, editors, and creators.",
    tone: "cta",
    popular: true,
    tokensPerMonth: 10_000,
    monthly: PLAN_PRICES.verify.monthly,
    yearly: PLAN_PRICES.verify.yearly,
    features: [
      "Everything in Check",
      "Browser extension on every site",
      "Paraphrase + tone forensics",
      "Priority support",
    ],
  },
  {
    id: "certify",
    name: "Certify",
    tagline: "Forensic-grade reports your reviewers can cite.",
    tone: "gold",
    tokensPerMonth: 50_000,
    monthly: PLAN_PRICES.certify.monthly,
    yearly: PLAN_PRICES.certify.yearly,
    features: [
      "Everything in Verify",
      "Shareable verification reports",
      "12-month audit trail",
      "API access",
      "Re-scans free on every new model release",
    ],
  },
  {
    id: "team",
    name: "Team",
    tagline: "Shared detection workspace for the whole org.",
    tone: "accent",
    // Team token budgets are admin-assigned per account, so we don't
    // commit to a single number here. The picker renders "Custom" and
    // the CTA opens the sales mailto rather than Stripe checkout.
    tokensPerMonth: null,
    monthly: PLAN_PRICES.team.monthly,
    yearly: PLAN_PRICES.team.yearly,
    features: [
      "Everything in Certify",
      "Custom token allotment per seat",
      "Shared collections + monitors",
      "SSO + role-based access",
      "Workspace-wide model picks",
      "Dedicated success manager",
    ],
  },
];

/** Plans for which the in-app upgrade CTA should be hidden — the user
 *  is at the top of the self-serve ladder, or on a custom team account
 *  where self-serve upgrades don't apply. */
export const TOP_PLANS = new Set<Plan>(["certify", "team"]);

/** Format a token count for display. `null` → "Custom" (Team plan). */
export function formatTokens(n: number | null): string {
  if (n === null) return "Custom";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function getPlan(id: Plan): PlanInfo {
  const found = PLANS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown plan: ${id}`);
  return found;
}

/** Plain-English label for the user's current plan, used in copy. */
export const PLAN_LABEL: Record<Plan, string> = {
  check: "Check",
  verify: "Verify",
  certify: "Certify",
  team: "Team",
};

/** Email opened by the Team plan's "Talk to us" CTA — Team can't be
 *  bought self-serve since each account gets a custom token allotment. */
export const TEAM_SALES_MAILTO =
  "mailto:sales@heynotai.io?subject=Team%20plan";

/** Plan ordering for upgrade/downgrade comparisons. Team is at the
 *  top but is admin-provisioned, so the CTA helpers special-case it. */
export const PLAN_RANK: Record<Plan, number> = {
  check: 0,
  verify: 1,
  certify: 2,
  team: 3,
};

/** Closed set of CTA semantics any plan card might render. The visual
 *  variant + label are derived in `ctaCopy`; the click action is
 *  derived in the page's onPick router. */
export type CtaKind =
  | "anonymous_signup"
  | "current"
  | "switch_cycle_up"
  | "switch_cycle_down"
  | "upgrade"
  | "downgrade"
  | "cancel_to_free"
  | "contact";

/** Resolve which CTA a plan card should show, given the visitor's
 *  current state. Single source of truth for /pricing, /app/upgrade,
 *  and the settings PlanCard. */
export function resolveCta(
  card: Plan,
  cardCycle: PlanCycle,
  current: { plan: Plan; cycle: PlanCycle | null } | null,
): CtaKind {
  // Team is contact-sales, regardless of who's looking.
  if (card === "team") return "contact";

  // Anonymous: always offer signup. Free card → "Get started", paid
  // cards → "Upgrade to X" (we still rank them as upgrades because
  // there's no current plan to downgrade from).
  if (!current) return "anonymous_signup";

  const samePlan = card === current.plan;
  const sameCycle = cardCycle === current.cycle;

  if (samePlan && sameCycle) return "current";

  if (samePlan) {
    // Current plan, different cycle. monthly→yearly is the savings
    // upsell; yearly→monthly is the rare downscale.
    if (current.cycle === "monthly" && cardCycle === "yearly") {
      return "switch_cycle_up";
    }
    return "switch_cycle_down";
  }

  if (PLAN_RANK[card] > PLAN_RANK[current.plan]) return "upgrade";

  // Lower-ranked card. Drop to free has its own kind so the router
  // can send the user to /app/settings (cancel flow) instead of the
  // upgrade page.
  if (card === "check") return "cancel_to_free";
  return "downgrade";
}

/** Display copy + visual variant for each CTA kind. */
export function ctaCopy(
  kind: CtaKind,
  card: Plan,
): { label: string; variant: "solid" | "outline" | "disabled" } {
  const name = PLAN_LABEL[card];
  switch (kind) {
    case "anonymous_signup":
      return card === "check"
        ? { label: "Get started — free", variant: "solid" }
        : { label: `Upgrade to ${name}`, variant: "solid" };
    case "current":
      return { label: "Currently on this plan", variant: "disabled" };
    case "switch_cycle_up":
      return { label: "Switch to yearly · save 17%", variant: "solid" };
    case "switch_cycle_down":
      return { label: "Switch to monthly", variant: "outline" };
    case "upgrade":
      return { label: `Upgrade to ${name}`, variant: "solid" };
    case "downgrade":
      return { label: `Downgrade to ${name}`, variant: "outline" };
    case "cancel_to_free":
      return { label: "Switch to free", variant: "outline" };
    case "contact":
      return { label: "Talk to us", variant: "outline" };
  }
}
