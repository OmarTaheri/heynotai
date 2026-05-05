# pocketbase

PocketBase v0.23 binary + container for heynotai.

## Schema

Schema lives in `setup-schema.sh` (an idempotent admin-API script), **not** in
`pb_migrations/`. The JS migration files in this folder are kept for reference
but are not loaded — PB v0.23 changed the `fields.add(…)` API in a way that
breaks these specific files, and the simplest fix was to bypass the migration
system entirely.

## Setup (fresh database)

```bash
# 1. start PB
pnpm pb:up

# 2. create a superuser (8+ char password required)
docker exec heynotai-pocketbase pocketbase --dir=/pb_data \
  superuser create admin@aui.ma adminadmin

# 3. apply the heynotai schema
bash pocketbase/setup-schema.sh

# 4. (optional) re-add Google OAuth in the admin UI
#    http://127.0.0.1:8090/_/  →  users collection  →  Options  →  OAuth2
```

## What the script creates

- `users` (auth) — extended with:
  - **Profile**: name, handle, avatar, avatarUrl, timezone, language
  - **Onboarding**: onboardingCompleted, role, useCases, connections
  - **Plan**: plan, planCycle (monthly/yearly), planBadge, planRenewsOn
  - **Billing**: billingEmail, billingAddress, billingCountry, taxId
  - **Payment metadata**: paymentBrand, paymentLast4, paymentExpires (last4
    and expiry only — full card data never touches our DB; it stays in Stripe)
  - **Stripe linkage**: stripeCustomerId, stripeSubscriptionId
- `appearance_prefs` — one row per user (theme, dateFormat, motion, etc.).
- `notification_prefs` — one row per user; `prefs` is a `{event: {channel: bool}}`
  matrix.
- `privacy_prefs` — one row per user (retention, training, analytics, public profile).
- `invoices` — read-only for users; the api service writes via a superuser
  token from Stripe webhook events. Keyed by `stripeInvoiceId` (unique).

All prefs collections enforce `userId = @request.auth.id` for read/write.
Invoices have read-only client access; webhook writes only.

## Re-running

`setup-schema.sh` is idempotent. Re-run after pulling changes that add
fields. Existing collections will report "Failed to create" (already
exist) — that's fine; field additions on `users` are merged in via
PATCH each time.
