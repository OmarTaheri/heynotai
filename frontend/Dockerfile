# Build context for this Dockerfile is the repo root (see
# docker-compose.yml — `context: .`), so the @heynotai/shared workspace
# package is reachable. NEXT_PUBLIC_* values are passed through as
# build args because Next bakes them into the client bundle.

# ── extension zip ──────────────────────────────────────────────────
# Builds the sideload .zip the /install page hands visitors. Lives in
# its own stage so wxt's transitive deps don't pollute the frontend
# install, and so the artifact is reproducible from a clean image
# instead of relying on a developer to commit it.
FROM node:22-alpine AS ext-build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY api/package.json api/
COPY shared/package.json shared/
COPY frontend/package.json frontend/
COPY extension/package.json extension/

RUN pnpm install --frozen-lockfile --filter @heynotai/extension...

COPY shared shared
COPY extension extension
# wxt names the zip `<package-name>-<version>-chrome.zip`; rename to a
# stable filename so the COPY in the frontend build stage doesn't have
# to track version bumps.
RUN pnpm --filter @heynotai/extension zip \
    && mv /repo/extension/.output/*-chrome.zip /repo/extension/.output/heynotai-extension.zip

# ── deps ───────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY api/package.json api/
COPY shared/package.json shared/
COPY frontend/package.json frontend/
COPY extension/package.json extension/

RUN pnpm install --frozen-lockfile --filter @heynotai/frontend...

# ── build ──────────────────────────────────────────────────────────
FROM deps AS build
ARG NEXT_PUBLIC_POCKETBASE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_POCKETBASE_URL=$NEXT_PUBLIC_POCKETBASE_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1

COPY shared shared
COPY frontend frontend
# Drop the prebuilt extension zip into public/ before `next build` so
# Next picks it up as a static asset. The frontend's prebuild script
# soft-fails when extension/.output is absent (it is here), leaving
# this COPY in place.
COPY --from=ext-build /repo/extension/.output/heynotai-extension.zip frontend/public/downloads/heynotai-extension.zip
RUN pnpm --filter @heynotai/frontend build

# ── runtime ────────────────────────────────────────────────────────
# Uses Next's standalone output (frontend/next.config.ts:
# output: "standalone"). Gives us a self-contained server bundle so we
# don't ship the full pnpm node_modules tree in the runtime image.
FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=build /repo/frontend/.next/standalone ./
COPY --from=build /repo/frontend/.next/static ./frontend/.next/static
COPY --from=build /repo/frontend/public ./frontend/public

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "frontend/server.js"]
