FROM ghcr.io/muchobien/pocketbase:0.23

# Schema is applied via pocketbase/setup-schema.sh (idempotent admin API
# script), NOT via JS migrations — PB v0.23 changed fields.add(...) in a
# way that breaks the existing migration files (see pocketbase/README.md).
# COPYing pb_migrations into the image makes PB enter a crash loop on
# fresh databases because every boot retries the broken update migration.
# pb_data is mounted via docker-compose.

EXPOSE 8090
