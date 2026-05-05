#!/bin/bash
# Seed a demo user + sample collection + sample scans so the
# /app pages have something to render right after a fresh deploy.
# Idempotent — every step skips itself if the row already exists.
#
# Gated by HEYNOTAI_SEED in entrypoint.sh; running it by hand is
# also safe at any time:
#   bash /seed.sh "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"
#
# Demo credentials:
#   email:    O.Taheri@aui.ma
#   password: O.Taheri

set -e

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="${1:-admin@aui.ma}"
ADMIN_PASS="${2:-adminadmin}"

SEED_EMAIL="O.Taheri@aui.ma"
SEED_PASSWORD="O.Taheri"
SEED_NAME="O. Taheri"

echo "→ authenticating as $ADMIN_EMAIL"
TOKEN=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c "import sys, json; print(json.load(sys.stdin).get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "✗ admin login failed — skipping seed"
  exit 1
fi

# Helper: pull a single record id from a list result, or empty string.
first_id() {
  python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d['items'][0]['id'] if d.get('items') else '')
"
}

# ── Seed user ───────────────────────────────────────────────────────
USER_ID=$(curl -s -G "$PB_URL/api/collections/users/records" \
  -H "Authorization: $TOKEN" \
  --data-urlencode "filter=email='$SEED_EMAIL'" \
  | first_id)

if [ -n "$USER_ID" ]; then
  echo "→ seed user already exists ($USER_ID) — skipping creation"
else
  echo "→ creating seed user $SEED_EMAIL"
  RESP=$(curl -s -X POST "$PB_URL/api/collections/users/records" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$SEED_EMAIL\",
      \"password\": \"$SEED_PASSWORD\",
      \"passwordConfirm\": \"$SEED_PASSWORD\",
      \"name\": \"$SEED_NAME\",
      \"emailVisibility\": true,
      \"verified\": true,
      \"plan\": \"check\",
      \"onboardingCompleted\": true
    }")
  USER_ID=$(echo "$RESP" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id',''))")
  if [ -z "$USER_ID" ]; then
    echo "✗ failed to create seed user:"
    echo "$RESP"
    exit 1
  fi
  echo "  user id: $USER_ID"
fi

# ── Sample collection ───────────────────────────────────────────────
COLL_ID=$(curl -s -G "$PB_URL/api/collections/collections/records" \
  -H "Authorization: $TOKEN" \
  --data-urlencode "filter=userId='$USER_ID' && slug='demo'" \
  | first_id)

if [ -n "$COLL_ID" ]; then
  echo "→ demo collection already exists ($COLL_ID) — skipping"
else
  echo "→ creating sample collection 'Demo library'"
  RESP=$(curl -s -X POST "$PB_URL/api/collections/collections/records" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"$USER_ID\",
      \"slug\": \"demo\",
      \"title\": \"Demo library\",
      \"description\": \"Auto-seeded collection so the /app pages have content.\",
      \"tone\": \"human\",
      \"pattern\": \"dots\"
    }")
  COLL_ID=$(echo "$RESP" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id',''))")
  if [ -z "$COLL_ID" ]; then
    echo "  (failed: $(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("message",""))'))"
  fi
fi

# ── Sample scans ────────────────────────────────────────────────────
SCAN_COUNT=$(curl -s -G "$PB_URL/api/collections/scans/records" \
  -H "Authorization: $TOKEN" \
  --data-urlencode "filter=userId='$USER_ID'" \
  --data-urlencode "perPage=1" \
  | python3 -c "import sys, json; print(json.load(sys.stdin).get('totalItems', 0))")

if [ "$SCAN_COUNT" -gt "0" ]; then
  echo "→ user already has $SCAN_COUNT scans — skipping seed scans"
else
  echo "→ creating sample scans"
  for ENTRY in \
    '{"title":"Welcome — sample text check","type":"txt","origin":"paste","verdict":"human","aiPct":12,"confidence":0.84,"status":"done","wordCount":420}' \
    '{"title":"Sample AI image","type":"img","origin":"upload","verdict":"ai","aiPct":91,"confidence":0.93,"status":"done"}' \
    '{"title":"Sample audio clip","type":"aud","origin":"upload","verdict":"mixed","aiPct":56,"confidence":0.7,"status":"done"}' \
    '{"title":"Sample YouTube video","type":"vid","origin":"link","sourceUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","verdict":"human","aiPct":18,"confidence":0.81,"status":"done"}'
  do
    PAYLOAD=$(python3 -c "
import sys, json
e = json.loads(sys.argv[1])
e['userId'] = '$USER_ID'
print(json.dumps(e))
" "$ENTRY")
    curl -s -X POST "$PB_URL/api/collections/scans/records" \
      -H "Authorization: $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" > /dev/null
  done
  echo "  4 scans seeded"
fi

# ── Default prefs rows (one-row-per-user collections) ──────────────
for COLL in appearance_prefs notification_prefs privacy_prefs extension_prefs; do
  EXISTING=$(curl -s -G "$PB_URL/api/collections/$COLL/records" \
    -H "Authorization: $TOKEN" \
    --data-urlencode "filter=userId='$USER_ID'" \
    | first_id)
  if [ -z "$EXISTING" ]; then
    echo "→ creating default $COLL row for seed user"
    curl -s -X POST "$PB_URL/api/collections/$COLL/records" \
      -H "Authorization: $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"userId\":\"$USER_ID\"}" > /dev/null
  fi
done

echo "✓ seed complete — log in as $SEED_EMAIL / $SEED_PASSWORD"
