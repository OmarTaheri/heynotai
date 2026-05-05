# Build context for this Dockerfile is the repo root (see
# docker-compose.yml — `context: .`), because the Hono API depends on
# the @heynotai/shared workspace package via `workspace:*`. pnpm needs
# the whole monorepo metadata to resolve that link.

# ── deps ───────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# Copy only the manifests + lockfile first so this layer caches when
# source changes but deps don't.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY api/package.json api/
COPY shared/package.json shared/
COPY frontend/package.json frontend/
COPY extension/package.json extension/

RUN pnpm install --frozen-lockfile --filter @heynotai/api...

# ── build ──────────────────────────────────────────────────────────
FROM deps AS build
COPY shared shared
COPY api api
RUN pnpm --filter @heynotai/api build
# Drop devDeps in-place so the runtime stage just copies what's left.
# We keep pnpm's native symlink layout (.pnpm/ + per-pkg node_modules)
# instead of trying to hoist or `pnpm deploy`, which both broke in
# subtle ways with this workspace. Carrying the whole /repo into the
# runtime image is ~50 MB heavier but matches the layout the build
# produced, so module resolution works without surprise.
RUN pnpm install --frozen-lockfile --prod --filter @heynotai/api...

# ── runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
# Native binaries the api shells out to:
#   - ffmpeg: frame extraction in api/src/detectors/hf-video.ts
#     (fluent-ffmpeg is just a wrapper around the binary)
#   - yt-dlp: resolves YouTube URLs to video bytes in
#     api/src/lib/youtube-download.ts. Required for /scans with
#     `type=vid + sourceUrl=<youtube>` (the extension's auto-scan flow).
#     YouTube periodically rotates extraction ciphers — if scans start
#     failing with `youtube_unavailable`, rebuild the image to pull a
#     fresh yt-dlp from Alpine community.
#   - tini: PID 1 reaper (avoids zombie ffmpeg/yt-dlp child processes).
RUN apk add --no-cache ffmpeg yt-dlp tini
WORKDIR /repo/api
ENV NODE_ENV=production \
    PORT=8787

COPY --from=build /repo /repo

EXPOSE 8787
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
