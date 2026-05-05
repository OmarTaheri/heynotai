FROM ghcr.io/muchobien/pocketbase:0.23

# muchobien's image expects migrations at /pb_migrations (sibling of
# /pb_data and /pb_hooks). Earlier this was COPY'd to /pb/pb_migrations
# which PB never scanned, so new migration files never ran. The data
# dir itself is volumed in via docker-compose.
COPY pb_migrations /pb_migrations

EXPOSE 8090
