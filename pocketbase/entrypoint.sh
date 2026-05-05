#!/bin/sh
# Ensure the superuser specified in PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD
# exists before starting PocketBase. `superuser upsert` creates the
# account if missing and resets the password if it's already there,
# so this is idempotent — safe to run on every container start.
#
# Without this, a fresh /pb_data has no admin and the /_/ login page
# rejects anything you type. Coolify env vars become the source of
# truth for the admin credentials.
set -e

if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  echo "[heynotai] ensuring superuser $PB_ADMIN_EMAIL"
  if ! pocketbase --dir=/pb_data superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"; then
    echo "[heynotai] superuser upsert failed (continuing — log in with the previously-set password if any)"
  fi
else
  echo "[heynotai] PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD not set; skipping superuser bootstrap"
fi

exec pocketbase serve --http=0.0.0.0:8090
