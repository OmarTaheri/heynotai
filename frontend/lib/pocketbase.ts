"use client";

import PocketBase, { type RecordModel } from "pocketbase";

/* Singleton PB client. SDK keeps the auth token in `pb.authStore` and
 * persists to localStorage by default — that's enough for SPA + Next.js
 * client components. If we ever need SSR access to the token, switch to
 * a cookie-backed store using `pb.authStore.exportToCookie()` /
 * `loadFromCookie()` in middleware. */

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";

declare global {
  // Reuse the instance across HMR reloads in dev so the auth store
  // doesn't reset on every edit.
  // eslint-disable-next-line no-var
  var __heynotaiPB: PocketBase | undefined;
}

export const pb: PocketBase = globalThis.__heynotaiPB ?? new PocketBase(PB_URL);
if (typeof window !== "undefined") globalThis.__heynotaiPB = pb;

export type PBUserRecord = RecordModel & {
  email: string;
  name?: string;
  handle?: string;
  avatar?: string;
  timezone?: string;
  language?: string;
  plan?: string;
  planBadge?: string;
  planRenewsOn?: string;
  billingEmail?: string;
  billingAddress?: string;
  paymentMethodLast4?: string;
  paymentExpires?: string;
  taxId?: string;
  team?: string;
  verified?: boolean;
  mfa?: boolean;
};

export function avatarUrl(user: PBUserRecord | null): string | null {
  if (!user || !user.avatar) return null;
  return pb.files.getURL(user, user.avatar);
}
