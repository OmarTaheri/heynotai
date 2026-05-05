import Stripe from "stripe";
import { env } from "../env.js";

/** Server-side Stripe client. The key is required at runtime — fail
 *  loudly if it's missing so we don't spend a request building an
 *  invalid client. The api version is pinned to the date `stripe@22.x`
 *  ships with so type definitions stay aligned. */
function makeStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to api/.env (rk_test_… or sk_test_…) " +
        "and restart the api dev server.",
    );
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia",
  });
}

let _client: Stripe | null = null;
export function stripe(): Stripe {
  if (!_client) _client = makeStripe();
  return _client;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}
