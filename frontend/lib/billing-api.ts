"use client";

import { pb } from "./pocketbase";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

type CheckoutResponse = {
  subscriptionId: string;
  clientSecret: string;
};

type CheckoutBody = {
  plan: "verify" | "certify";
  cycle: "monthly" | "yearly";
  billingAddress?: string;
  billingCountry?: string;
  taxId?: string;
  billingEmail?: string;
};

/** Server-side: creates the Stripe Customer if missing, then a
 *  Subscription with `default_incomplete`. The returned client secret
 *  is what `confirmPayment` consumes in the browser. */
export async function startCheckout(body: CheckoutBody): Promise<CheckoutResponse> {
  const r = await fetch(`${API_URL}/billing/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pb.authStore.token}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new BillingError(detail?.error ?? "checkout_failed", r.status, detail);
  }
  return (await r.json()) as CheckoutResponse;
}

/** Tells the backend the PaymentIntent succeeded so it can sync PB
 *  with the new plan/cycle/last4 immediately, without waiting on the
 *  webhook. The webhook is still the canonical source of truth. */
export async function confirmCheckout(subscriptionId: string): Promise<void> {
  const r = await fetch(`${API_URL}/billing/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pb.authStore.token}`,
    },
    body: JSON.stringify({ subscriptionId }),
  });
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new BillingError(detail?.error ?? "confirm_failed", r.status, detail);
  }
}

/** Reconcile the local user record with Stripe by pulling the live
 *  subscription state. Used as a self-heal when /confirm never landed
 *  (tab closed mid-payment) or the webhook is misconfigured. Safe to
 *  call repeatedly. */
export async function syncSubscription(): Promise<void> {
  const r = await fetch(`${API_URL}/billing/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pb.authStore.token}`,
    },
  });
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new BillingError(detail?.error ?? "sync_failed", r.status, detail);
  }
}

export type PreviewItem = {
  plan: "verify" | "certify";
  cycle: "monthly" | "yearly";
  sticker: number;
  credit?: number;
  totalDueToday?: number;
  currency: string;
  error?: string;
};

export type PreviewResponse = {
  proration: boolean;
  items: PreviewItem[];
};

/** Batched proration preview for the chargeable plan combinations.
 *  When the user has no active subscription, only sticker prices come
 *  back (proration=false). Otherwise each item carries credit +
 *  totalDueToday computed by Stripe's invoice preview. */
export async function previewChange(
  targets?: Array<{ plan: "verify" | "certify"; cycle: "monthly" | "yearly" }>,
): Promise<PreviewResponse> {
  const r = await fetch(`${API_URL}/billing/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pb.authStore.token}`,
    },
    body: JSON.stringify(targets ? { targets } : {}),
  });
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new BillingError(detail?.error ?? "preview_failed", r.status, detail);
  }
  return (await r.json()) as PreviewResponse;
}

export type ChangeResponse = {
  deferred: boolean;
  pendingPlan?: string;
  pendingPlanCycle?: string;
  pendingPlanEffective?: string;
};

/** In-place plan/cycle change for an existing subscription. Upgrades
 *  + cycle bumps fire immediately (Stripe charges the prorated amount
 *  on the card on file); downgrades are deferred to period end via a
 *  Stripe schedule. Returns `deferred` so the UI can render the right
 *  confirmation copy. */
export async function changeSubscription(body: {
  plan: "verify" | "certify";
  cycle: "monthly" | "yearly";
}): Promise<ChangeResponse> {
  const r = await fetch(`${API_URL}/billing/change`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pb.authStore.token}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new BillingError(detail?.error ?? "change_failed", r.status, detail);
  }
  return (await r.json()) as ChangeResponse;
}

/** Schedule the user's subscription to end at the current period's
 *  end. They keep paid features until then. Returns the effective
 *  date so the UI can confirm what the user is committing to. */
export async function cancelSubscription(): Promise<{
  pendingPlanEffective: string;
}> {
  const r = await fetch(`${API_URL}/billing/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pb.authStore.token}`,
    },
  });
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new BillingError(detail?.error ?? "cancel_failed", r.status, detail);
  }
  return (await r.json()) as { pendingPlanEffective: string };
}

/** Undo a scheduled cancellation (only valid before the period ends). */
export async function undoCancelSubscription(): Promise<void> {
  const r = await fetch(`${API_URL}/billing/cancel/undo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pb.authStore.token}`,
    },
  });
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new BillingError(
      detail?.error ?? "cancel_undo_failed",
      r.status,
      detail,
    );
  }
}

export class BillingError extends Error {
  constructor(
    public code: string,
    public status: number,
    public detail: unknown,
  ) {
    super(`Billing error: ${code}`);
  }
}
