# Deploying heynotai on Coolify

**No code changes are needed.** `docker-compose.yaml` is already written for
Coolify — it uses the `SERVICE_FQDN_*` magic variables, builds both images from
the repo root, and keeps Postgres and uploads on named volumes. Everything
below is configuration.

## 1. Create the resource

New Resource → **Docker Compose** → point it at this repo, branch `main`,
compose file `docker-compose.yaml`. Three services come up: `postgres`, `api`,
`frontend`.

## 2. Environment variables

Set these in Coolify's **Environment Variables** tab. The four marked **build**
must have Coolify's *Build Variable* toggle on — they are baked into images at
build time, and setting them only as runtime variables silently produces a
frontend that calls `localhost`.

The full filled-in list for this deployment, including which of your current
variables to delete, is in `deploy/coolify-env.secret.md` (git-ignored).

### Database

The api uses the bundled `postgres` service. `docker-compose.yaml` builds its
connection string from `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
and the service name, so **there is no `DATABASE_URL` variable to set** — do
not add one back in Coolify's UI. To use a managed database instead, edit the
`DATABASE_URL:` line in the compose file to the literal URL; leaving it as an
`${...}` interpolation is what makes Coolify treat the variable as
compose-managed and refuse to let you delete it.

`POSTGRES_PASSWORD` is now a real credential rather than a formality, and it is
interpolated into a URL — keep it to characters that need no percent-encoding
(letters, digits, `-`, `.`, `_`, `~`). Postgres applies it only when it
initializes an empty data directory, so once `postgres_data` exists, changing
the variable locks the api out with `password authentication failed`. Rotating
it means dumping, deleting the volume, and restoring.

### Secrets — generate fresh, never reuse across environments

| Variable | Value |
| --- | --- |
| `POSTGRES_PASSWORD` | long random string |
| `AUTH_PASSWORD_PEPPER` | long random string |
| `FILE_URL_SECRET` | long random string, different from the pepper |
| `CREDENTIAL_ENCRYPTION_KEY` | exactly 64 hex characters (`openssl rand -hex 32`) |

Rotating `AUTH_PASSWORD_PEPPER` after launch invalidates **every** stored
password hash — nobody can sign in with a password again. Rotating
`CREDENTIAL_ENCRYPTION_KEY` makes stored provider credentials undecryptable.
Set both once, before the first real user.

### URLs and origins

| Variable | Value | |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.heynotai.com` | **build** |
| `FRONTEND_URL` | `https://heynotai.com` | **build** |
| `API_PUBLIC_URL` | `https://api.heynotai.com` | |
| `CORS_ORIGINS` | `https://heynotai.com,chrome-extension://*` | |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | your Stripe publishable key | **build** |
| `SERVICE_FQDN_API_8787` | `api.heynotai.com` | |
| `SERVICE_FQDN_FRONTEND_3000` | `heynotai.com` | |

`NEXT_PUBLIC_API_URL` and `FRONTEND_URL` are also what the Dockerfile feeds to
the extension-zip build stage as `VITE_API_URL` / `VITE_FRONTEND_URL`, so the
sideload zip on `/install` points at production too. `CORS_ORIGINS` matches a
trailing `*` as a prefix, so `chrome-extension://*` covers every install of the
extension.

### Extension and auth

| Variable | Value |
| --- | --- |
| `EXTENSION_IDS` | `dmnmdeccfhicgfjmcehkmpkfpakccbkj,blffhfijmlabjphlccpmdhjkninakchg` |
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://api.heynotai.com/auth/google/callback` |
| `ADMIN_EMAILS` | your own email — grants the admin pages on sign-in |

The first extension ID is the one the Chrome Web Store assigned; the second is
the pinned dev/local-test ID. Sign-in redirects to
`https://<extension-id>.chromiumapp.org/website-auth`, and
`validateExtensionRedirect` rejects any ID not in this list.

**Google Cloud needs nothing per-extension.** `beginGoogleOAuth` sends Google
`redirect_uri = GOOGLE_REDIRECT_URI` and keeps the chromiumapp.org URL in the
`oauth_states` row, applying it only after Google has returned to the API's own
callback. Google never sees an extension ID, and the extension itself holds no
client ID and never calls `chrome.identity.getAuthToken`. The one thing that
must match Google Cloud exactly, path included, is `GOOGLE_REDIRECT_URI`.

Do check the **OAuth consent screen publishing status**: while it is in
*Testing*, only accounts added as test users can sign in with Google, and
everyone else is blocked. The app requests `openid email profile` only — all
non-sensitive — so publishing does not require Google's verification review.

### Detection providers

| Variable | Value |
| --- | --- |
| `HUGGINGFACE_TOKEN` | Hugging Face inference token |

Without it every scan fails: the seeded `huggingface` provider row carries
`{"credentialEnv":"HUGGINGFACE_TOKEN"}`, and `resolveProviderCredential` falls
back to that environment variable when no credential is stored in the database.
You can instead paste the token into the admin Providers page after deploy,
where it is encrypted with `CREDENTIAL_ENCRYPTION_KEY`.

## 3. Database — nothing manual

There is no migration step and no separate seed step for the catalog.
`api/src/index.ts` calls `initializeDatabase()` at boot, which applies every
file in `api/migrations/` exactly once under a Postgres advisory lock, so
concurrent container starts are safe. The providers and detection-model catalog
are themselves migrations (`0002_seed_model_catalog.sql`,
`0003_replace_velma_with_modal_audio.sql`), so a fresh database is fully seeded
the moment the API starts.

Two consequences worth knowing:

- Applied migrations are checksummed and immutable. Editing an already-applied
  `.sql` file makes the next deploy fail on purpose; schema changes go in a new
  numbered file.
- Your admin account is granted by `ADMIN_EMAILS` at sign-in, not by a seed —
  just register normally on the website with that address.

## 4. Seed the Chrome Web Store reviewer account

Also automatic — no `docker exec` step. Set these two variables and deploy:

```
REVIEWER_EMAIL=chrome-review@heynotai.com
REVIEWER_PASSWORD=<the password you gave the store>
```

`api/src/services/seed-reviewer.ts` runs at boot right after the migrations and
creates the account with `email_verified` set, `system_role = 'user'`, and plan
`certify` (override with `REVIEWER_PLAN`) so no quota or model-tier wall
interrupts the review. It is idempotent: every boot syncs the account to the
current environment, so rotating the password after a review round is an
environment edit plus a restart. Leaving the variables set is safe, and
omitting them makes the seed a no-op. A bad value warns in the logs rather than
failing the boot — an optional seed must never take the API down.

## 5. Verify before submitting to the store

| Check | Expected |
| --- | --- |
| `https://api.heynotai.com/health` | HTTP 200, `services.database.ok: true` |
| `https://heynotai.com/privacy` | HTTP 200 — the store checks this URL |
| `https://heynotai.com/extension-auth` | HTTP 200 — extension sign-in starts here |
| Sign in on the website with the reviewer credentials | succeeds |
| Load `03-LOCAL-TEST/chrome-load-unpacked`, sign in, run one text check | verdict returns |

A `Failed to fetch` in the extension usually means `CORS_ORIGINS` is missing
the extension origin; `invalid_extension_redirect` means the ID is missing from
`EXTENSION_IDS`.

## Persistence

`postgres_data` and `uploads_data` are named volumes. Uploaded scan media lives
in `uploads_data` at `/data/uploads` — include both in whatever backup you run,
and do not let a Coolify "delete volumes" cleanup touch them.
