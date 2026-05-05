FROM ghcr.io/muchobien/pocketbase:0.23

# Schema is applied via pocketbase/setup-schema.sh (idempotent admin API
# script), NOT via JS migrations — PB v0.23 changed fields.add(...) in a
# way that breaks the existing migration files (see pocketbase/README.md).
# COPYing pb_migrations into the image makes PB enter a crash loop on
# fresh databases because every boot retries the broken update migration.
# pb_data is mounted via docker-compose.

# setup-schema.sh needs bash, curl, and python3 (for JSON parsing) —
# none ship with the upstream Alpine image.
RUN apk add --no-cache bash curl python3

# Bake the schema definition + scripts in so the entrypoint can apply
# them on every boot, and so `docker exec <container> bash /setup-schema.sh`
# (or /seed.sh) is available straight from Coolify's terminal without
# needing to copy files in first.
#   schema.json    – source-of-truth collections snapshot, applied via
#                    PB's /api/collections/import endpoint.
#   setup-schema.sh – runs the import.
#   seed.sh         – optional demo user + sample data, gated by the
#                    HEYNOTAI_SEED env var in entrypoint.sh.
COPY schema.json /schema.json
COPY setup-schema.sh /setup-schema.sh
COPY seed.sh /seed.sh
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /setup-schema.sh /seed.sh /entrypoint.sh

EXPOSE 8090
ENTRYPOINT ["/entrypoint.sh"]
