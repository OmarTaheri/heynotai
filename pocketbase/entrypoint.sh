#!/bin/sh
# Boot sequence for the heynotai PocketBase container:
#
#   1. Upsert the superuser from PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD so
#      /_/ login works on fresh deploys (the upstream image doesn't
#      auto-create one from env vars).
#   2. Start `pocketbase serve` in the background.
#   3. Wait for the HTTP API to be ready, then run setup-schema.sh
#      against localhost so all collections exist before clients
#      connect. The script is idempotent — running it on every boot
#      just no-ops when collections already exist, and applies any
#      newly-added schema bits when the script is updated.
#   4. `wait` on the pocketbase process so PID 1 stays alive and
#      Docker stop signals are forwarded cleanly.
set -e

if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  echo "[heynotai] ensuring superuser $PB_ADMIN_EMAIL"
  if ! pocketbase --dir=/pb_data superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"; then
    echo "[heynotai] superuser upsert failed (continuing)"
  fi
else
  echo "[heynotai] PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD not set; skipping superuser bootstrap"
fi

pocketbase serve --http=0.0.0.0:8090 &
PB_PID=$!

# Forward SIGTERM/SIGINT to pocketbase so `docker stop` shuts down
# cleanly instead of waiting the full 10s grace period.
_term() {
  echo "[heynotai] forwarding signal to pocketbase ($PB_PID)"
  kill -TERM "$PB_PID" 2>/dev/null || true
  wait "$PB_PID"
  exit 0
}
trap _term TERM INT

echo "[heynotai] waiting for pocketbase to accept HTTP traffic"
ready=false
for _ in $(seq 1 60); do
  if wget -q -O /dev/null http://127.0.0.1:8090/api/health 2>/dev/null; then
    ready=true
    break
  fi
  sleep 1
done

if [ "$ready" = "true" ] && [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  echo "[heynotai] applying schema via /setup-schema.sh"
  if ! PB_URL=http://127.0.0.1:8090 bash /setup-schema.sh "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"; then
    echo "[heynotai] schema apply reported errors (continuing — PB itself is up)"
  fi

  # detection_models is required for every scan — the api throws
  # `no_model_available` when this collection is empty. Always run
  # the model seeder; it's an idempotent upsert by slug.
  echo "[heynotai] seeding detection_models via /seed-models.sh"
  if ! PB_URL=http://127.0.0.1:8090 bash /seed-models.sh "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"; then
    echo "[heynotai] model seed reported errors (continuing)"
  fi

  # Optional demo data — only seeds when HEYNOTAI_SEED is explicitly
  # set to "true". Production deploys leave the var unset so the test
  # account never auto-creates itself. The script is idempotent so a
  # truthy value across deploys is safe.
  if [ "$HEYNOTAI_SEED" = "true" ]; then
    echo "[heynotai] HEYNOTAI_SEED=true — running /seed.sh"
    if ! PB_URL=http://127.0.0.1:8090 bash /seed.sh "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"; then
      echo "[heynotai] seed reported errors (continuing — PB itself is up)"
    fi
  fi
elif [ "$ready" != "true" ]; then
  echo "[heynotai] pocketbase didn't become ready within 60s; skipping schema apply"
fi

wait "$PB_PID"
