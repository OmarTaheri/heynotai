# heynotai

AI-generated media detection for the web.

heynotai brings text, image, audio, and video analysis into two places: a web workspace for managing scans and a browser extension for checking content in context.

> **Important:** AI-content detectors are probabilistic. A result is evidence to investigate—not proof of authorship, authenticity, or intent. See [Limitations](#limitations).

<!-- Add a product screenshot or short demo GIF here. -->

## What it includes

- **Browser extension** — a WXT/React extension with in-page detection workflows and a YouTube drawer.
- **Web application** — a Next.js workspace for uploads, scans, results, history, models, team settings, and billing.
- **Detection API** — a Hono/TypeScript service that validates requests, coordinates detectors, enforces plan limits, and records results.
- **PocketBase** — authentication, application records, realtime updates, migrations, and file storage.
- **Shared contracts** — Zod schemas and TypeScript types used across packages.
- **Billing** — Stripe checkout, subscriptions, plan mapping, and webhook processing.

## Architecture

```text
Browser extension ─┐
                   ├── auth/realtime ──▶ PocketBase
Web application ───┤
                   └── scan requests ──▶ Hono API ──▶ detector providers
                                             │
                                             ├──▶ PocketBase
                                             └──▶ Stripe
```

The API owns detector orchestration and privileged application operations. Clients use PocketBase for authentication and selected realtime/file workflows. Production deployments therefore need both private service-to-service URLs and correctly configured public client URLs.

## Repository structure

```text
heynotai/
├── api/          Hono API and detector integrations
├── extension/    WXT + React browser extension
├── frontend/     Next.js web application
├── pocketbase/   container, schema, migrations, and seed scripts
├── shared/       shared TypeScript types and Zod schemas
├── docker-compose.yaml
└── pnpm-workspace.yaml
```

## Local development

### Prerequisites

- Node.js 20+
- pnpm 9
- Docker with Compose
- credentials for any detector or billing provider you want to exercise

### Setup

```bash
git clone https://github.com/OmarTaheri/heynotai.git
cd heynotai
pnpm install

cp api/.env.example api/.env
cp frontend/.env.example frontend/.env.local
```

Replace every placeholder credential before starting the stack. Never deploy the example PocketBase administrator account.

Start PocketBase:

```bash
pnpm pb:up
```

Run the API and frontend in separate terminals:

```bash
pnpm dev:api
pnpm dev:frontend
```

Run the extension:

```bash
pnpm dev:extension
```

Load the generated development extension in a Chromium browser as instructed by WXT.

## Quality checks

```bash
pnpm typecheck
pnpm test
pnpm build:api
pnpm build:frontend
pnpm build:extension
```

Current automated coverage is concentrated in the shared package. API integration, billing, extension, and browser end-to-end coverage are active priorities.

## Deployment

`docker-compose.yaml` provides a production-shaped deployment for:

- `pocketbase`
- `api`
- `frontend`

The compose file includes Coolify-compatible service URL variables. Review every environment variable and network boundary before using it outside a development environment.

## Limitations

- Detection models can produce false positives and false negatives.
- Performance varies by modality, language, compression, editing, and model/provider.
- A score should not be used by itself for disciplinary, legal, employment, or academic-integrity decisions.
- Provider availability and limits can affect scan results.
- A public benchmark and model card are not yet included in this repository.

## Status

heynotai is under active development at version `0.1`. Interfaces and data models may change.

## Security and privacy

Do not report vulnerabilities in a public issue. Contact the maintainer privately through the contact information at [omartaheri.com](https://omartaheri.com).

Before deploying:

- generate unique PocketBase administrator credentials;
- use test-mode Stripe credentials until the full billing flow is verified;
- set explicit CORS origins;
- configure public and private PocketBase URLs correctly;
- define retention and deletion rules for uploaded media and scan results.

## License

No open-source license is currently declared. You may inspect the source, but no reuse rights are granted until a license is added.
