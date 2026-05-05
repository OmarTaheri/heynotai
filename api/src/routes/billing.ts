import { Hono } from "hono";
import { z } from "zod";
import type Stripe from "stripe";
import { requireAuth } from "../middleware/auth.js";
import { stripe } from "../lib/stripe.js";
import { pbAdmin } from "../lib/pb-admin.js";
import {
  CHARGEABLE_PLANS,
  isChargeablePlan,
  priceIdFor,
  type ChargeablePlan,
  type PlanCycle,
} from "../lib/plans.js";
import { env } from "../env.js";

/** Plan-rank source of truth on the server. Mirrors
 *  `frontend/lib/plans-data.ts:PLAN_RANK`. */
const PLAN_RANK: Record<string, number> = {
  check: 0,
  verify: 1,
  certify: 2,
  team: 3,
};

export const billing = new Hono();

const checkoutBody = z.object({
  plan: z.enum(["verify", "certify"]),
  cycle: z.enum(["monthly", "yearly"]),
  billingAddress: z.string().min(1).max(500).optional(),
  billingCountry: z.string().min(2).max(4).optional(),
  taxId: z.string().max(60).optional(),
  billingEmail: z.string().email().max(200).optional(),
});

/** POST /billing/checkout
 *  Auth: required.
 *  Body: { plan, cycle, billingAddress?, billingCountry?, taxId? }
 *  Returns: { subscriptionId, clientSecret }
 *
 *  Flow:
 *    1. Reject Team — it's contact-sales, no Stripe price exists.
 *    2. Resolve the price ID for (plan, cycle) from env.
 *    3. Ensure the user has a Stripe Customer; create + persist if not.
 *    4. Create a Subscription with default_incomplete so we can
 *       confirm the first invoice's PaymentIntent client-side via
 *       Stripe Elements.
 *    5. Return the client secret. The frontend confirms; the webhook
 *       handler is the source of truth for final plan state. */
billing.post("/checkout", requireAuth, async (c) => {
  const parsed = checkoutBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
  }
  const { plan, cycle, billingAddress, billingCountry, taxId, billingEmail } =
    parsed.data;
  console.log("[billing] /checkout", {
    userId: c.get("user")?.id,
    plan,
    cycle,
    hasAddress: !!billingAddress,
    country: billingCountry,
    hasBillingEmail: !!billingEmail,
  });

  if (!isChargeablePlan(plan)) {
    return c.json({ error: "unsupported_plan" }, 400);
  }
  const priceId = priceIdFor(plan, cycle as PlanCycle);
  if (!priceId) {
    return c.json(
      {
        error: "price_not_configured",
        message: `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()} is not set in api/.env.`,
      },
      500,
    );
  }

  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const pb = c.get("pb");

  // Ensure a Stripe Customer for this user; create + persist on first call.
  let stripeCustomerId = (user.stripeCustomerId as string | undefined) ?? "";
  if (!stripeCustomerId) {
    const customer = await stripe().customers.create({
      email: billingEmail || (user.email as string),
      name: (user.name as string | undefined) || undefined,
      metadata: { userId: user.id },
      address: billingAddress
        ? {
            line1: billingAddress,
            country: billingCountry || undefined,
          }
        : undefined,
    });
    stripeCustomerId = customer.id;
    await pb.collection("users").update(user.id, {
      stripeCustomerId,
      ...(billingAddress ? { billingAddress } : {}),
      ...(billingCountry ? { billingCountry } : {}),
      ...(taxId ? { taxId } : {}),
      ...(billingEmail ? { billingEmail } : {}),
    });
  } else if (billingAddress || billingCountry || taxId || billingEmail) {
    // Update Stripe customer + persist on PB user.
    await stripe().customers.update(stripeCustomerId, {
      ...(billingEmail ? { email: billingEmail } : {}),
      address: billingAddress
        ? { line1: billingAddress, country: billingCountry || undefined }
        : undefined,
    });
    await pb.collection("users").update(user.id, {
      ...(billingAddress ? { billingAddress } : {}),
      ...(billingCountry ? { billingCountry } : {}),
      ...(taxId ? { taxId } : {}),
      ...(billingEmail ? { billingEmail } : {}),
    });
  }

  const subscription = (await stripe().subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.confirmation_secret"],
    metadata: { userId: user.id, plan, cycle },
  })) as Stripe.Subscription & {
    latest_invoice?: Stripe.Invoice & {
      confirmation_secret?: { client_secret?: string };
    };
  };

  const clientSecret =
    subscription.latest_invoice?.confirmation_secret?.client_secret ?? null;
  if (!clientSecret) {
    return c.json(
      {
        error: "no_client_secret",
        message:
          "Stripe didn't return a confirmation_secret. Check that the price is recurring and the API version supports it.",
      },
      500,
    );
  }

  return c.json({ subscriptionId: subscription.id, clientSecret });
});

/** POST /billing/confirm
 *  Auth: required.
 *  Body: { subscriptionId }
 *
 *  Called by the frontend after `stripe.confirmPayment()` resolves.
 *  We verify the subscription is active/trialing on Stripe's side and
 *  sync the user record in PB. The webhook is the canonical source —
 *  this exists to give the user immediate feedback without waiting on
 *  webhook delivery. */
const confirmBody = z.object({ subscriptionId: z.string().min(1) });

billing.post("/confirm", requireAuth, async (c) => {
  const parsed = confirmBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
  }

  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);
  console.log("[billing] /confirm", {
    userId: user.id,
    subscriptionId: parsed.data.subscriptionId,
  });

  const sub = await stripe().subscriptions.retrieve(parsed.data.subscriptionId, {
    expand: ["default_payment_method", "items.data.price"],
  });

  if (sub.metadata?.userId !== user.id) {
    return c.json({ error: "forbidden" }, 403);
  }

  const status = sub.status;
  if (status !== "active" && status !== "trialing") {
    return c.json({ error: "not_active", status }, 400);
  }

  const patch = subscriptionToUserPatch(sub);
  if (!patch) {
    return c.json(
      { error: "missing_plan_metadata", subscriptionId: sub.id },
      500,
    );
  }

  const pb = c.get("pb");
  const updated = await pb.collection("users").update(user.id, patch);

  return c.json({ user: updated });
});

/** POST /billing/sync
 *  Auth: required.
 *  Body: none.
 *
 *  Self-heal: pulls the live subscription from Stripe by the user's
 *  stripeCustomerId and writes the canonical fields into PB. Used
 *  when the webhook misfired or `/confirm` never landed (e.g. user
 *  closed the tab mid-payment). Safe to call repeatedly. */
billing.post("/sync", requireAuth, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const stripeCustomerId = (user.stripeCustomerId as string | undefined) ?? "";
  console.log("[billing] /sync hit", {
    userId: user.id,
    email: user.email,
    currentPlan: user.plan,
    stripeCustomerId: stripeCustomerId || "(none)",
  });

  if (!stripeCustomerId) {
    console.log("[billing] /sync bail: no stripeCustomerId on user record");
    return c.json({ synced: false, plan: "check", reason: "no_customer" });
  }

  const subs = await stripe().subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 5,
    expand: ["data.default_payment_method", "data.items.data.price"],
  });
  console.log("[billing] /sync stripe subs", {
    count: subs.data.length,
    statuses: subs.data.map((s) => ({
      id: s.id,
      status: s.status,
      planMeta: s.metadata?.plan,
    })),
  });

  const live = subs.data.find(
    (s) => s.status === "active" || s.status === "trialing",
  );

  const pb = c.get("pb");

  if (!live) {
    console.log("[billing] /sync: no active/trialing sub — writing plan=check");
    const updated = await pb.collection("users").update(user.id, {
      plan: "check",
      planCycle: "",
      planBadge: "FREE",
      planRenewsOn: "",
      stripeSubscriptionId: "",
    });
    return c.json({ synced: true, plan: "check", user: updated });
  }

  const patch = subscriptionToUserPatch(live);
  if (!patch) {
    console.log("[billing] /sync: subscription missing plan metadata", {
      subId: live.id,
      metadata: live.metadata,
    });
    return c.json(
      { error: "missing_plan_metadata", subscriptionId: live.id },
      500,
    );
  }

  console.log("[billing] /sync writing patch", patch);
  const updated = await pb.collection("users").update(user.id, patch);

  // Backfill invoices from Stripe. The webhook handler is the
  // canonical writer, but if it was misconfigured during a prior
  // payment the rows never landed. The `invoices` collection has
  // `createRule: null`, so we must use the admin client. Idempotent
  // against the unique stripeInvoiceId index — duplicates 400 and
  // we treat that as already-present.
  try {
    const invoices = await stripe().invoices.list({
      customer: stripeCustomerId,
      limit: 100,
    });
    const adminPb = await pbAdmin();
    let backfilled = 0;
    let alreadyPresent = 0;
    const errors: string[] = [];
    for (const inv of invoices.data) {
      if (inv.status !== "paid") continue;
      try {
        await adminPb.collection("invoices").create({
          userId: user.id,
          amount: (inv.amount_paid ?? 0) / 100,
          currency: inv.currency?.toUpperCase() ?? "USD",
          paidOn: new Date(
            (inv.status_transitions?.paid_at ??
              Math.floor(Date.now() / 1000)) * 1000,
          )
            .toISOString()
            .slice(0, 10),
          stripeInvoiceId: inv.id,
        });
        backfilled++;
      } catch (err) {
        const msg = (err as { message?: string })?.message ?? String(err);
        // PB returns 400 for unique-index violations; everything else
        // is a real error worth surfacing.
        if (
          /validation_not_unique|unique constraint/i.test(msg) ||
          (err as { status?: number })?.status === 400
        ) {
          alreadyPresent++;
        } else {
          errors.push(`${inv.id}: ${msg}`);
        }
      }
    }
    console.log("[billing] /sync invoices backfilled", {
      total: invoices.data.length,
      paid: invoices.data.filter((i) => i.status === "paid").length,
      newlyInserted: backfilled,
      alreadyPresent,
      errors,
    });
  } catch (err) {
    console.warn("[billing] /sync invoice backfill failed", err);
  }

  return c.json({ synced: true, plan: patch.plan, user: updated });
});

/** POST /billing/preview
 *  Auth: required.
 *  Body: { targets?: Array<{ plan, cycle }> }
 *
 *  Returns proration previews for each target combination. When the
 *  user has no active subscription, returns sticker prices only and
 *  `proration: false` so the frontend can show plain prices. When
 *  active, calls Stripe `invoices.createPreview` for each target in
 *  parallel. Read-only on Stripe's side. */
const previewBody = z.object({
  targets: z
    .array(
      z.object({
        plan: z.enum(["verify", "certify"]),
        cycle: z.enum(["monthly", "yearly"]),
      }),
    )
    .optional(),
});

billing.post("/preview", requireAuth, async (c) => {
  const parsed = previewBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
  }
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const targets =
    parsed.data.targets ??
    (CHARGEABLE_PLANS.flatMap((p) =>
      (["monthly", "yearly"] as const).map((cy) => ({ plan: p, cycle: cy })),
    ) as Array<{ plan: ChargeablePlan; cycle: PlanCycle }>);

  const subId = (user.stripeSubscriptionId as string | undefined) ?? "";
  const customerId = (user.stripeCustomerId as string | undefined) ?? "";

  // Sticker fallback: no live sub means there's nothing to pro-rate.
  if (!subId || !customerId) {
    const items = targets.map((t) => {
      const priceId = priceIdFor(t.plan as ChargeablePlan, t.cycle);
      return {
        plan: t.plan,
        cycle: t.cycle,
        sticker: 0,
        currency: "USD",
        priceId,
      };
    });
    return c.json({ proration: false, items });
  }

  const sub = await stripe().subscriptions.retrieve(subId, {
    expand: ["items.data.price"],
  });
  const item = sub.items.data[0];
  if (!item) {
    return c.json({ error: "no_subscription_item" }, 500);
  }

  const results = await Promise.all(
    targets.map(async (t) => {
      const priceId = priceIdFor(t.plan as ChargeablePlan, t.cycle);
      if (!priceId) {
        return {
          plan: t.plan,
          cycle: t.cycle,
          error: "price_not_configured" as const,
        };
      }
      try {
        const preview = await stripe().invoices.createPreview({
          customer: customerId,
          subscription: subId,
          subscription_details: {
            items: [{ id: item.id, price: priceId }],
            proration_behavior: "always_invoice",
          },
        });
        let credit = 0;
        let charge = 0;
        for (const line of preview.lines.data) {
          const amount = line.amount;
          if (amount < 0) credit += Math.abs(amount);
          else charge += amount;
        }
        const totalDueToday = preview.amount_due;
        const currency = (preview.currency ?? "usd").toUpperCase();
        return {
          plan: t.plan,
          cycle: t.cycle,
          sticker: charge / 100,
          credit: credit / 100,
          totalDueToday: totalDueToday / 100,
          currency,
        };
      } catch (err) {
        console.warn("[billing] /preview target failed", {
          plan: t.plan,
          cycle: t.cycle,
          error: (err as { message?: string })?.message ?? String(err),
        });
        return {
          plan: t.plan,
          cycle: t.cycle,
          error: "preview_failed" as const,
        };
      }
    }),
  );

  console.log("[billing] /preview", {
    userId: user.id,
    subId,
    items: results.length,
  });

  return c.json({ proration: true, items: results });
});

/** POST /billing/change
 *  Auth: required.
 *  Body: { plan, cycle }
 *
 *  In-place change of an existing subscription. Upgrades + cycle
 *  bumps fire immediately with `always_invoice` proration; downgrades
 *  defer to period end via Stripe subscription schedules. Either way,
 *  PB is updated synchronously; the webhook lands an idempotent
 *  re-write seconds later. */
const changeBody = z.object({
  plan: z.enum(["verify", "certify"]),
  cycle: z.enum(["monthly", "yearly"]),
});

billing.post("/change", requireAuth, async (c) => {
  const parsed = changeBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
  }
  const { plan, cycle } = parsed.data;
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  console.log("[billing] /change", {
    userId: user.id,
    targetPlan: plan,
    targetCycle: cycle,
    currentPlan: user.plan,
    currentCycle: user.planCycle,
  });

  const subId = (user.stripeSubscriptionId as string | undefined) ?? "";
  if (!subId) {
    return c.json({ error: "no_active_sub" }, 400);
  }

  const priceId = priceIdFor(plan, cycle);
  if (!priceId) {
    return c.json({ error: "price_not_configured" }, 500);
  }

  const sub = await stripe().subscriptions.retrieve(subId, {
    expand: ["items.data.price"],
  });
  const item = sub.items.data[0];
  if (!item) {
    return c.json({ error: "no_subscription_item" }, 500);
  }
  if (sub.metadata?.userId && sub.metadata.userId !== user.id) {
    return c.json({ error: "forbidden" }, 403);
  }

  const currentPlanRank = PLAN_RANK[user.plan as string] ?? 0;
  const targetPlanRank = PLAN_RANK[plan];
  const isPlanDowngrade = targetPlanRank < currentPlanRank;
  const isCycleDowngrade =
    user.plan === plan &&
    user.planCycle === "yearly" &&
    cycle === "monthly";
  const isDeferred = isPlanDowngrade || isCycleDowngrade;

  const pb = c.get("pb");

  if (!isDeferred) {
    // Upgrade or cycle-up: immediate switch, prorated charge today.
    const updatedSub = await stripe().subscriptions.update(subId, {
      items: [{ id: item.id, price: priceId }],
      metadata: { ...sub.metadata, userId: user.id, plan, cycle },
      proration_behavior: "always_invoice",
    });
    const patch = subscriptionToUserPatch(updatedSub);
    if (!patch) {
      return c.json({ error: "missing_plan_metadata" }, 500);
    }
    // Clear any previously scheduled downgrade — the immediate change
    // supersedes it.
    const updated = await pb.collection("users").update(user.id, {
      ...patch,
      pendingPlan: "",
      pendingPlanCycle: "",
      pendingPlanEffective: "",
    });
    console.log("[billing] /change immediate", { plan, cycle });
    return c.json({ deferred: false, user: updated });
  }

  // Deferred (downgrade): use a subscription schedule to apply the
  // change at current_period_end. Convert the live sub into a schedule
  // if it isn't on one already, then append (or replace) the trailing
  // phase with the target price.
  const periodEnd = item.current_period_end ?? Math.floor(Date.now() / 1000);
  let scheduleId =
    typeof sub.schedule === "string"
      ? sub.schedule
      : sub.schedule?.id ?? "";

  if (!scheduleId) {
    const schedule = await stripe().subscriptionSchedules.create({
      from_subscription: subId,
    });
    scheduleId = schedule.id;
  }

  const schedule = await stripe().subscriptionSchedules.retrieve(scheduleId);

  // Keep the existing first phase (which represents the current
  // subscription period) and replace anything after it with our new
  // target phase. Phases beyond the first might be leftovers from a
  // prior scheduled change that we're now overriding.
  const firstPhase = schedule.phases[0];
  if (!firstPhase) {
    return c.json({ error: "schedule_missing_phase" }, 500);
  }
  // Stripe's update-phase types accept `iterations` at runtime but
  // the TS def is narrower than the create variant — using a literal
  // annotation here would force a wider type cast on every field, so
  // we just type it as the broadest shape Stripe accepts.
  const phases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = [
    {
      items: firstPhase.items.map((it) => ({
        price:
          typeof it.price === "string" ? it.price : (it.price as Stripe.Price).id,
        quantity: it.quantity ?? 1,
      })),
      start_date: firstPhase.start_date,
      end_date: firstPhase.end_date ?? periodEnd,
      metadata: firstPhase.metadata ?? undefined,
      proration_behavior: "none",
    },
    {
      items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, plan, cycle },
      proration_behavior: "none",
      // iterations: 1 — appended below via a cast because Stripe's
      // update-phase type omits it even though the API accepts it.
    } as Stripe.SubscriptionScheduleUpdateParams.Phase,
  ];
  (phases[1] as unknown as { iterations: number }).iterations = 1;

  await stripe().subscriptionSchedules.update(scheduleId, {
    phases,
    end_behavior: "release",
  });

  const effectiveDate = new Date(periodEnd * 1000).toISOString().slice(0, 10);
  const updated = await pb.collection("users").update(user.id, {
    pendingPlan: plan,
    pendingPlanCycle: cycle,
    pendingPlanEffective: effectiveDate,
  });

  console.log("[billing] /change deferred", {
    plan,
    cycle,
    effectiveDate,
    scheduleId,
  });

  return c.json({
    deferred: true,
    user: updated,
    pendingPlan: plan,
    pendingPlanCycle: cycle,
    pendingPlanEffective: effectiveDate,
  });
});

/** POST /billing/cancel
 *  Auth: required.
 *  Body: none.
 *
 *  Schedules the user's subscription to end at the current period's
 *  end. The user keeps every paid feature until then; Stripe fires
 *  `customer.subscription.deleted` at the transition, which our
 *  webhook already handles by writing `plan: "check"`. */
billing.post("/cancel", requireAuth, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const subId = (user.stripeSubscriptionId as string | undefined) ?? "";
  if (!subId) {
    return c.json({ error: "no_active_sub" }, 400);
  }

  console.log("[billing] /cancel", {
    userId: user.id,
    subscriptionId: subId,
  });

  const sub = await stripe().subscriptions.update(subId, {
    cancel_at_period_end: true,
    metadata: { ...(user.stripeSubscriptionId ? {} : {}), userId: user.id },
  });

  // current_period_end lives on the first item, not the sub root in
  // recent API versions.
  const periodEnd =
    sub.items.data[0]?.current_period_end ??
    Math.floor(Date.now() / 1000);
  const effectiveDate = new Date(periodEnd * 1000).toISOString().slice(0, 10);

  const pb = c.get("pb");
  const updated = await pb.collection("users").update(user.id, {
    pendingPlan: "check",
    pendingPlanCycle: "",
    pendingPlanEffective: effectiveDate,
  });
  console.log("[billing] /cancel post-write user fields", {
    pendingPlan: updated.pendingPlan,
    pendingPlanCycle: updated.pendingPlanCycle,
    pendingPlanEffective: updated.pendingPlanEffective,
    plan: updated.plan,
    planCycle: updated.planCycle,
  });

  return c.json({
    cancelled: true,
    pendingPlanEffective: effectiveDate,
    user: updated,
  });
});

/** POST /billing/cancel/undo
 *  Auth: required.
 *  Body: none.
 *
 *  Clears the scheduled cancellation if the user changes their mind
 *  before the period ends. */
billing.post("/cancel/undo", requireAuth, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const subId = (user.stripeSubscriptionId as string | undefined) ?? "";
  if (!subId) {
    return c.json({ error: "no_active_sub" }, 400);
  }

  console.log("[billing] /cancel/undo", { userId: user.id, subId });

  await stripe().subscriptions.update(subId, {
    cancel_at_period_end: false,
  });

  const pb = c.get("pb");
  const updated = await pb.collection("users").update(user.id, {
    pendingPlan: "",
    pendingPlanCycle: "",
    pendingPlanEffective: "",
  });

  return c.json({ cancelled: false, user: updated });
});

/** Build the PB user patch from a Stripe Subscription. Shared by
 *  `/confirm` and `/sync` so the two write paths can't drift. Returns
 *  null when the subscription is missing the `plan` metadata tag —
 *  callers should surface that as an error rather than guessing. */
function subscriptionToUserPatch(
  sub: Stripe.Subscription,
): Record<string, unknown> | null {
  const item = sub.items.data[0];
  const interval = item?.price.recurring?.interval;
  const cycle: "monthly" | "yearly" = interval === "year" ? "yearly" : "monthly";
  const planMeta = sub.metadata?.plan;
  if (!isChargeablePlan(planMeta ?? "")) return null;

  const pm = sub.default_payment_method as Stripe.PaymentMethod | string | null;
  const card =
    pm && typeof pm !== "string" && pm.type === "card" ? pm.card : null;

  const periodEnd = item?.current_period_end ?? Math.floor(Date.now() / 1000);
  const renewsOn = new Date(periodEnd * 1000).toISOString().slice(0, 10);

  return {
    plan: planMeta,
    planCycle: cycle,
    planRenewsOn: renewsOn,
    planBadge: cycle.toUpperCase(),
    stripeSubscriptionId: sub.id,
    ...(card
      ? {
          paymentBrand: card.brand,
          paymentLast4: card.last4,
          paymentExpires: `${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}`,
        }
      : {}),
  };
}

/** POST /billing/webhook
 *  Public; verified via STRIPE_WEBHOOK_SECRET.
 *
 *  Mirrors subscription state into PB asynchronously. This is the
 *  authoritative path: even if the user closes the tab during
 *  /confirm, the webhook will land state correctly. */
billing.post("/webhook", async (c) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return c.json(
      {
        error: "webhook_secret_missing",
        message: "Set STRIPE_WEBHOOK_SECRET in api/.env to enable webhooks.",
      },
      500,
    );
  }
  const sig = c.req.header("stripe-signature");
  if (!sig) return c.json({ error: "no_signature" }, 400);

  const raw = await c.req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      raw,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return c.json(
      { error: "invalid_signature", detail: (err as Error).message },
      400,
    );
  }

  console.log("[billing] webhook", { type: event.type, id: event.id });
  switch (event.type) {
    case "invoice.payment_succeeded":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.updated":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await downgradeOnCancel(event.data.object as Stripe.Subscription);
      break;
    default:
      // Unhandled event type — acknowledge so Stripe stops retrying.
      break;
  }

  return c.json({ received: true });
});

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Subscription invoices don't carry userId in their own metadata;
  // it lives on the Customer (set when /checkout created it). Pull
  // it from there.
  let userId = invoice.metadata?.userId;
  if (!userId && typeof invoice.customer === "string") {
    try {
      const cust = await stripe().customers.retrieve(invoice.customer);
      if (!cust.deleted) {
        userId = (cust as Stripe.Customer).metadata?.userId;
      }
    } catch (err) {
      console.warn("[billing] handleInvoicePaid customer lookup failed", err);
    }
  }
  if (!userId) {
    console.warn("[billing] handleInvoicePaid bail: no userId resolvable", {
      invoiceId: invoice.id,
      customer: invoice.customer,
    });
    return;
  }
  const pb = await pbAdmin();
  try {
    await pb.collection("invoices").create({
      userId,
      amount: (invoice.amount_paid ?? 0) / 100,
      currency: invoice.currency?.toUpperCase() ?? "USD",
      paidOn: new Date(
        (invoice.status_transitions?.paid_at ?? Math.floor(Date.now() / 1000)) *
          1000,
      )
        .toISOString()
        .slice(0, 10),
      stripeInvoiceId: invoice.id,
    });
    console.log("[billing] handleInvoicePaid wrote invoice", {
      userId,
      invoiceId: invoice.id,
    });
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? String(err);
    if (/validation_not_unique|unique constraint/i.test(msg)) {
      // Duplicate event redelivery — already stored. Fine.
    } else {
      console.warn("[billing] handleInvoicePaid create failed", err);
    }
  }
}

async function syncSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  console.log("[billing] webhook syncSubscription", {
    subId: sub.id,
    status: sub.status,
    userId,
    planMeta: sub.metadata?.plan,
  });
  if (!userId) {
    console.log("[billing] webhook syncSubscription bail: no userId in metadata");
    return;
  }
  const item = sub.items.data[0];
  const interval = item?.price.recurring?.interval;
  const cycle: "monthly" | "yearly" = interval === "year" ? "yearly" : "monthly";
  const plan = sub.metadata?.plan ?? "verify";
  const periodEnd = item?.current_period_end ?? Math.floor(Date.now() / 1000);
  const renewsOn = new Date(periodEnd * 1000).toISOString().slice(0, 10);
  const pb = await pbAdmin();

  // If the user had a deferred downgrade scheduled and this update
  // brings the active plan/cycle in line with what was pending, the
  // schedule transition just landed — clear the pending hints.
  let clearPending = false;
  try {
    const userRec = await pb.collection("users").getOne(userId);
    if (
      userRec &&
      userRec.pendingPlan &&
      userRec.pendingPlan === plan &&
      (!userRec.pendingPlanCycle || userRec.pendingPlanCycle === cycle)
    ) {
      clearPending = true;
    }
  } catch {
    // best effort — if we can't read the user, don't crash the webhook
  }

  await pb.collection("users").update(userId, {
    plan: sub.status === "active" || sub.status === "trialing" ? plan : "check",
    planCycle: cycle,
    planRenewsOn: renewsOn,
    stripeSubscriptionId: sub.id,
    ...(clearPending
      ? {
          pendingPlan: "",
          pendingPlanCycle: "",
          pendingPlanEffective: "",
        }
      : {}),
  });
}

async function downgradeOnCancel(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) return;
  const pb = await pbAdmin();
  await pb.collection("users").update(userId, {
    plan: "check",
    planCycle: "",
    stripeSubscriptionId: "",
  });
}
