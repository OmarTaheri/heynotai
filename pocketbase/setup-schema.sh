#!/bin/bash
# Apply the heynotai PocketBase schema by uploading pocketbase/schema.json
# (a snapshot of every collection's full definition) through PB's bulk
# import endpoint. Idempotent — `deleteMissing: false` means existing
# collections get their fields/rules merged in, and ones not in the
# snapshot are left alone (so user-created collections in PB admin UI
# survive).
#
# Why import vs. per-collection POST: we used to declare collections
# inline as shell heredocs but the list grew to ~18 (scans, teams,
# extension_prefs, …) and the script kept drifting from production.
# The JSON snapshot is the source of truth, generated from a known-good
# pb_data. Re-snapshot via:
#   curl ... /api/collections | jq '{collections: [.items[] | select(.name | startswith("_") | not)]}' \
#     > pocketbase/schema.json
#
# Usage: bash /setup-schema.sh [admin-email] [admin-password]

set -e

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
SCHEMA_FILE="${SCHEMA_FILE:-/schema.json}"
EMAIL="${1:-admin@aui.ma}"
PASSWORD="${2:-adminadmin}"

if [ ! -f "$SCHEMA_FILE" ]; then
  # Fallback for `bash pocketbase/setup-schema.sh` from the repo root
  if [ -f "pocketbase/schema.json" ]; then
    SCHEMA_FILE="pocketbase/schema.json"
  else
    echo "✗ schema file not found: $SCHEMA_FILE"
    exit 1
  fi
fi

echo "→ authenticating as $EMAIL"
TOKEN=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "✗ login failed — check email/password"
  exit 1
fi

echo "→ importing collections from $SCHEMA_FILE"
COLLECTIONS_JSON=$(python3 -c "import json; d=json.load(open('$SCHEMA_FILE')); print(json.dumps(d['collections']))")

HTTP_CODE=$(curl -s -o /tmp/pb-import.json -w '%{http_code}' \
  -X PUT "$PB_URL/api/collections/import" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"collections\": $COLLECTIONS_JSON, \"deleteMissing\": false}")

if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✓ schema setup complete"
else
  echo "✗ import failed (HTTP $HTTP_CODE)"
  cat /tmp/pb-import.json 2>/dev/null
  exit 1
fi
