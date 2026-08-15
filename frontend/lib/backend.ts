"use client";

import {
  BackendClient,
  type BackendRecord,
} from "@heynotai/shared";

/** API-owned client for authentication and application data. */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

declare global {
  // Reuse auth state across Next development HMR reloads.
  // eslint-disable-next-line no-var
  var __heynotaiBackend: BackendClient | undefined;
}

export const backend =
  globalThis.__heynotaiBackend ?? new BackendClient(API_URL);
if (typeof window !== "undefined") globalThis.__heynotaiBackend = backend;

export type BackendUserRecord = BackendRecord & {
  email: string;
  name?: string;
  handle?: string;
  avatar?: string;
  avatarUrl?: string;
  timezone?: string;
  language?: string;
  plan?: string;
  planCycle?: "monthly" | "yearly";
  planBadge?: string;
  planRenewsOn?: string;
  pendingPlan?: string;
  pendingPlanCycle?: "monthly" | "yearly";
  pendingPlanEffective?: string;
  billingEmail?: string;
  billingAddress?: string;
  billingCountry?: string;
  paymentBrand?: string;
  paymentLast4?: string;
  paymentExpires?: string;
  taxId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  team?: string;
  verified?: boolean;
  mfa?: boolean;
  onboardingCompleted?: boolean;
  systemRole?: "admin" | "user";
};

export function avatarUrl(user: BackendUserRecord | null): string | null {
  if (!user || !user.avatar) return null;
  return backend.files.getURL(user, user.avatar);
}
