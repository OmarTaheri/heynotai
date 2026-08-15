# heynotai

AI-generated text, image, audio, and video detection for the web.

> AI-content detectors are probabilistic. Treat a result as evidence to investigate, not proof of authorship, authenticity, or intent.

## What is included

- Next.js web workspace and WXT browser extension.
- Hono API with API-owned password sessions and Google OAuth.
- PostgreSQL for users, application data, model configuration, audit events, and durable logs.
- Configurable local/API model providers with encrypted credentials.
- Declarative request templates and response adapters for provider-specific result formats.
- Platform admin panel for system state, users, quotas, providers, models, limits, tests, and logs.
- Filesystem uploads for local deployments and Stripe billing integration.

## Architecture

```text
Web application ─┐
                 ├── sessions/data/files ──> Hono API ──> PostgreSQL
Browser extension┘                         │       └──> upload storage
                                           ├──> local model runtimes
                                           ├──> hosted model APIs
                                           └──> Stripe
```

All browser data operations pass through the API. The model runtime converts every provider response into the canonical result shape `{ verdict, confidence, aiProbability, model }`; arbitrary database-stored JavaScript is never executed.

## Local setup

Requirements: Node.js 20+, pnpm 9, and Docker Compose.

```bash
pnpm install
copy api/.env.example api/.env
copy frontend/.env.example frontend/.env.local
pnpm db:up
pnpm dev:api
pnpm dev:frontend
```

`pnpm db:up` reads `.env.local-stack`, which holds the local PostgreSQL credentials and is passed to Docker Compose explicitly. The API applies checked-in SQL migrations on startup and serves on `http://localhost:8787`; the frontend serves on `http://localhost:3010`.

`pnpm dev:api` reseeds two development accounts on every start, both with the password in `DEV_LOGIN_PASSWORD`:

| Role | Email |
| --- | --- |
| Admin | `admin@heynotai.local` |
| User | `user@heynotai.local` |

For the extension, `pnpm dev:extension` runs the WXT dev server. To load a static build against the local stack instead, run `pnpm --filter @heynotai/extension build:local` and load `extension/.output/chrome-mv3-dev` as an unpacked extension. `pnpm --filter @heynotai/extension build` targets production hosts and is only for release packaging — its `VITE_FRONTEND_URL` must be serving `/extension-auth`, or extension sign-in fails with "Authorization page could not be loaded."

Generate independent production secrets for:

- `POSTGRES_PASSWORD`
- `AUTH_PASSWORD_PEPPER`
- `FILE_URL_SECRET`
- `CREDENTIAL_ENCRYPTION_KEY` (32 bytes, hex/base64, or a 32+ character passphrase)

Set `ADMIN_EMAILS` to a comma-separated list before those accounts register or sign in with Google. Those users receive the server-owned `systemRole=admin` claim; the ordinary profile `role` field is not used for platform authorization.

## Admin panel

Sign in with an address listed in `ADMIN_EMAILS`, then open `/app/admin`.

- `/app/admin` — users, scans, service state, reliability, and recent failures.
- `/app/admin/users` — search users, suspend/activate accounts, edit plan and monthly quota, revoke sessions, or delete.
- `/app/admin/providers` — hosted HTTP, OpenAI-compatible, Hugging Face, Velma, and local HTTP connections; encrypted write-only credentials; health tests; timeout/retry/RPM/concurrency limits.
- `/app/admin/models` — add, clone, edit, archive, enable, and test models; configure modality, plan access, cost, input/execution limits, request construction, and response mapping.
- `/app/admin/logs` — filter persistent structured logs by severity, service, event, user, scan, model, provider, or request ID.

The same structured logs are mirrored to the API process output, so `pnpm dev:api` and `docker logs` show request, audit, and error lines without a database query. `LOG_STDOUT` selects the format (`auto`, `pretty`, `json`, `off`) and `LOG_STDOUT_LEVEL` the minimum severity.

Model response mapping supports classification lists, scalar scores, direct verdicts, segment/frame results, and bounded JSON paths. Use the sample-response test in the model editor before enabling a new adapter.

For local runtimes, add allowed hostnames to `ALLOWED_LOCAL_MODEL_HOSTS`. Remote providers require HTTPS and cannot target private IP literals.

## Google authentication

Create a Web application OAuth client in Google Cloud and configure:

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback
```

The authorized redirect URI in Google Cloud must exactly match `GOOGLE_REDIRECT_URI`. Production should use the public HTTPS API URL. Add extension IDs to `EXTENSION_IDS`; the extension uses a server-mediated PKCE flow and exchanges a one-time code rather than copying the web session.

## Model providers

Seeded Hugging Face and Velma rows use `HUGGINGFACE_TOKEN` and `VELMA_API_KEY` as optional environment fallbacks. Credentials entered through the admin panel are encrypted with `CREDENTIAL_ENCRYPTION_KEY` and are returned only as masked hints.

Custom providers can select JSON, binary, or multipart requests and use bounded templates such as `{{input.text}}`, `{{input.mime}}`, and `{{model.externalId}}`. Response adapters use a restricted mapping schema; do not store executable code in model configuration.

## Quality checks

```bash
pnpm typecheck
pnpm test
pnpm build:api
pnpm build:frontend
pnpm build:extension
```

`pnpm test` runs the unit suites in every package, including the
extension's rules for page classification, auto-scan gating, verdict
rendering, and scan-error copy.

The extension also has an end-to-end suite that loads the built MV3
bundle into a real browser profile and drives the drawer:

```bash
pnpm --filter @heynotai/extension e2e
```

Two prerequisites. It needs a browser that still honours
`--load-extension`, which since Chrome 137 means **Microsoft Edge** —
the suite tries Edge first, then Chrome, and `HEYNOTAI_E2E_CHANNEL`
overrides the choice. And its signed-in specs need the API running
(`pnpm dev:api`); they skip themselves with a message when it isn't,
rather than failing. The `e2e` script builds in development mode on
purpose, so the bundle points at `http://localhost:8787` instead of
production.

## Deployment

`docker-compose.yaml` runs PostgreSQL, the API, and the frontend. Database and upload volumes are persistent. Back up both volumes and configure retention for `system_logs`, audit events, and uploaded media.

## Limitations

- Models can produce false positives and false negatives.
- Results vary by modality, language, compression, editing, and provider availability.
- A score alone should not drive legal, employment, academic, or disciplinary decisions.
- The built-in job table records work, but this version still starts scan execution in the API process; a dedicated multi-instance worker is the next operational hardening step.

No open-source license is currently declared.
