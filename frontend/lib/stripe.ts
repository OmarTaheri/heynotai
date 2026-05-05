"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

/** Single Stripe.js promise reused across mounts. `loadStripe` itself
 *  caches by key, but pinning the promise in module scope lets us pass
 *  the same reference into every <Elements> tree without flicker. */
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export const stripePromise: Promise<Stripe | null> = PUBLISHABLE_KEY
  ? loadStripe(PUBLISHABLE_KEY)
  : Promise.resolve(null);

export function isStripeReady(): boolean {
  return Boolean(PUBLISHABLE_KEY);
}
