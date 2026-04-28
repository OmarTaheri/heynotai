# heynotai

Real-time AI-generated content detector. Three client surfaces (browser extension + web app) talk to a single API service; storage and auth live in Pocketbase, which is never exposed publicly.

## Repository layout

```
heynotai/
├── extension/      Chrome MV3 extension — vanilla JS, its own design, self-contained
├── frontend/       Next.js 15 web app — its own design, consumes shared types
├── api/            Hono (TypeScript) — public API: routes, AI adapters, PB calls
├── pocketbase/     Pocketbase — storage + auth, private (behind the API)
├── shared/         Shared code — ONLY types + zod schemas. Nothing else.
│
├── pnpm-workspace.yaml
├── package.json            root devDeps only (typescript, eslint, prettier)
├── tsconfig.base.json      everyone extends this
├── docker-compose.yml      api + pocketbase for local dev
└── README.md
```

## Request flow

```
  extension ──┐
              ├──HTTPS + JWT──▶  api  ──▶  pocketbase  (auth, DB)
   frontend ──┘                  │
                                 └─▶  AI providers (OpenAI / Anthropic / custom)
```

- **The `api/` folder is the only public surface.** Frontend and extension never call Pocketbase directly.
- **Pocketbase is internal.** It runs on a private network in production (localhost on the same box as the API).
- **AI calls originate from `api/`.** Adapters live in `api/src/lib/ai/`.

## Each folder in detail

### `extension/`
Chrome Manifest V3 extension. Popup (the Veritas-style dashboard), content script (YouTube overlay + badge + detail panel), and background service worker. **Owns its own design** — popup CSS tokens, YouTube overlay styles, everything. Vanilla HTML/CSS/JS today; not part of the pnpm workspace. Migration to TypeScript is optional and can happen later without restructuring.

### `frontend/`
Next.js 15 (App Router) web app. Marketing pages + authenticated dashboard. **Owns its own design** — free to use Tailwind, its own component library, and a distinct visual identity from the extension popup. Imports `@heynotai/shared` for types and API response schemas. Talks to `api/` over HTTP.

### `api/`
Hono-based HTTP service in TypeScript. Everything API-related lives here — routes, middleware, AI provider adapters, Pocketbase client. Consumes `@heynotai/shared` for zod schemas (request validation) and types. If the frontend or extension wants typed calls, they write their own small fetch wrapper and import response types from `@heynotai/shared`.

### `pocketbase/`
Pocketbase instance: the binary plus `pb_migrations/` (schema as versioned JS files), `pb_hooks/` (extension points, mostly unused since Hono owns the logic), and a Dockerfile. Not a Node package and not part of the workspace.

### `shared/`
The **only** place shared code lives. Strictly TypeScript types and zod schemas — no runtime logic, no components, no utilities. Consumed by `api/` and `frontend/`. The extension deliberately does not consume it (it's vanilla JS and its API surface is narrow).

## Design philosophy

- Each client surface owns its design. The extension popup and the web dashboard solve different UX problems and should feel different.
- Types are the only thing worth sharing — they're the contract.
- Flat top-level structure. No `apps/` + `packages/` + `services/` nesting. Easy to navigate.
- Pocketbase is invisible to clients, so it can be swapped later (Postgres, Supabase, custom) without touching any client code.

## Running locally (once scaffolded)

```bash
# bring up api + pocketbase
docker-compose up -d

# frontend
cd frontend && pnpm install && pnpm dev

# extension — load unpacked from extension/ in chrome://extensions
```

## Status

- `extension/` — implemented (Veritas-style popup + YouTube content script).
- `api/`, `frontend/`, `pocketbase/`, `shared/` — folders created, scaffolding pending.
