FROM ghcr.io/muchobien/pocketbase:0.23

# Mount migrations into the image; pb auto-runs them on startup when
# the data dir is fresh. The data dir itself is volumed in via docker-compose.
COPY pb_migrations /pb/pb_migrations

EXPOSE 8090
