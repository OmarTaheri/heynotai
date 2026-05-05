#!/bin/bash
# One-shot script that creates the heynotai schema in a fresh PocketBase
# install. Replaces the JS migration system (which choked on PB v0.23
# field constructor syntax). Idempotent enough — re-running is safe;
# field/collection creation skips if it already exists (PB returns 400
# but we ignore those).
#
# Usage:  bash pocketbase/setup-schema.sh [admin-email] [admin-password]

set -e

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
EMAIL="${1:-admin@aui.ma}"
PASSWORD="${2:-adminadmin}"

echo "→ authenticating as $EMAIL"
TOKEN=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "✗ login failed — check email/password"
  exit 1
fi

USERS_ID=$(curl -s -H "Authorization: $TOKEN" "$PB_URL/api/collections/users" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "→ users collection id: $USERS_ID"

# ── Patch the users collection with all the heynotai-specific fields.
#    PATCH replaces the entire `fields` list, so we re-declare the
#    built-in auth fields too (id/email/password/etc are managed by
#    PB and cannot be removed; the `fields` array merges with system
#    fields). Send only our additions; PB keeps system fields intact.
echo "→ patching users collection"
curl -s -X PATCH "$PB_URL/api/collections/$USERS_ID" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON' > /tmp/pb-users.json
{
  "fields": [
    { "name": "id", "type": "text", "system": true, "primaryKey": true, "min": 15, "max": 15, "pattern": "^[a-z0-9]+$", "autogeneratePattern": "[a-z0-9]{15}" },
    { "name": "email", "type": "email", "system": true, "required": true },
    { "name": "emailVisibility", "type": "bool", "system": true },
    { "name": "verified", "type": "bool", "system": true },
    { "name": "tokenKey", "type": "text", "system": true, "min": 30, "max": 60, "hidden": true, "autogeneratePattern": "[a-zA-Z0-9_]{50}" },
    { "name": "password", "type": "password", "system": true, "hidden": true, "min": 8 },
    { "name": "name", "type": "text", "max": 200 },
    { "name": "handle", "type": "text", "max": 60 },
    { "name": "avatar", "type": "file", "maxSelect": 1, "maxSize": 5242880, "mimeTypes": ["image/jpeg","image/png","image/webp"] },
    { "name": "avatarUrl", "type": "url" },
    { "name": "timezone", "type": "text", "max": 80 },
    { "name": "language", "type": "select", "maxSelect": 1, "values": ["en","es","fr","de","zh","ar","ja"] },
    { "name": "plan", "type": "select", "maxSelect": 1, "values": ["check","verify","certify","team"] },
    { "name": "planCycle", "type": "select", "maxSelect": 1, "values": ["monthly","yearly"] },
    { "name": "planBadge", "type": "text", "max": 40 },
    { "name": "planRenewsOn", "type": "date" },
    { "name": "billingEmail", "type": "email" },
    { "name": "billingAddress", "type": "text", "max": 500 },
    { "name": "billingCountry", "type": "text", "max": 4 },
    { "name": "taxId", "type": "text", "max": 60 },
    { "name": "paymentBrand", "type": "text", "max": 30 },
    { "name": "paymentLast4", "type": "text", "max": 8 },
    { "name": "paymentExpires", "type": "text", "max": 8 },
    { "name": "stripeCustomerId", "type": "text", "max": 60 },
    { "name": "stripeSubscriptionId", "type": "text", "max": 60 },
    { "name": "onboardingCompleted", "type": "bool" },
    { "name": "role", "type": "text", "max": 40 },
    { "name": "useCases",    "type": "json", "maxSize": 4000 },
    { "name": "connections", "type": "json", "maxSize": 4000 },
    { "name": "created", "type": "autodate", "onCreate": true },
    { "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
  ]
}
JSON
python3 -c "import json; d=json.load(open('/tmp/pb-users.json')); print(' ', d.get('message','ok'))"

# ── Helper to create a one-row-per-user prefs collection.
make_prefs_collection() {
  local NAME="$1"
  local FIELDS_JSON="$2"
  echo "→ creating $NAME collection"
  curl -s -X POST "$PB_URL/api/collections" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(cat <<JSON
{
  "type": "base",
  "name": "$NAME",
  "fields": [
    { "name": "userId", "type": "relation", "collectionId": "$USERS_ID", "maxSelect": 1, "required": true },
    $FIELDS_JSON,
    { "name": "created", "type": "autodate", "onCreate": true },
    { "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX \`idx_${NAME}_user\` ON \`$NAME\` (\`userId\`)"
  ],
  "listRule":   "userId = @request.auth.id",
  "viewRule":   "userId = @request.auth.id",
  "createRule": "userId = @request.auth.id",
  "updateRule": "userId = @request.auth.id",
  "deleteRule": "userId = @request.auth.id"
}
JSON
)" > /tmp/pb-coll.json
  python3 -c "import json; d=json.load(open('/tmp/pb-coll.json')); print(' ', d.get('message') or 'created')"
}

make_prefs_collection "appearance_prefs" '
    { "name": "theme", "type": "select", "maxSelect": 1, "values": ["paper","night","system"] },
    { "name": "dateFormat", "type": "text", "max": 40 },
    { "name": "showAuthenticVerdicts", "type": "bool" }
'

make_prefs_collection "notification_prefs" '
    { "name": "prefs", "type": "json", "maxSize": 100000 }
'

make_prefs_collection "privacy_prefs" '
    { "name": "scanRetention", "type": "text", "max": 60 },
    { "name": "modelTraining", "type": "bool" },
    { "name": "anonymousAnalytics", "type": "bool" },
    { "name": "publicProfile", "type": "bool" }
'

# ── Invoices collection (read-only for users; the API service writes
#    via a superuser token from Stripe webhook events).
echo "→ creating invoices collection"
curl -s -X POST "$PB_URL/api/collections" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSON
{
  "type": "base",
  "name": "invoices",
  "fields": [
    { "name": "userId", "type": "relation", "collectionId": "$USERS_ID", "maxSelect": 1, "required": true },
    { "name": "amount", "type": "number", "required": true },
    { "name": "currency", "type": "text", "max": 6 },
    { "name": "paidOn", "type": "date" },
    { "name": "pdf", "type": "file", "maxSelect": 1, "maxSize": 10485760 },
    { "name": "stripeInvoiceId", "type": "text", "max": 60 },
    { "name": "created", "type": "autodate", "onCreate": true }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX \`idx_invoices_stripe\` ON \`invoices\` (\`stripeInvoiceId\`)"
  ],
  "listRule":   "userId = @request.auth.id",
  "viewRule":   "userId = @request.auth.id",
  "createRule": null,
  "updateRule": null,
  "deleteRule": null
}
JSON
)" > /tmp/pb-coll.json
python3 -c "import json; d=json.load(open('/tmp/pb-coll.json')); print(' ', d.get('message') or 'created')"

# ── Updates collection (the public changelog feed at /app/updates).
#    Authenticated users can read; only admins (or the API service via
#    superuser token) can write. Widget slots are stored as JSON so the
#    same <UpdateCard> renders every kind without schema branching.
echo "→ creating updates collection"
curl -s -X POST "$PB_URL/api/collections" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(cat <<'JSON'
{
  "type": "base",
  "name": "updates",
  "fields": [
    { "name": "slug", "type": "text", "max": 80, "required": true },
    { "name": "kind", "type": "select", "maxSelect": 1, "required": true, "values": ["new-model","accuracy","product","fix"] },
    { "name": "contentType", "type": "select", "maxSelect": 1, "values": ["txt","img","vid","aud"] },
    { "name": "dayGroup", "type": "select", "maxSelect": 1, "required": true, "values": ["this-week","last-week","earlier-april"] },
    { "name": "timestamp", "type": "text", "max": 80, "required": true },
    { "name": "publishedAt", "type": "date" },
    { "name": "title", "type": "text", "max": 400, "required": true },
    { "name": "description", "type": "editor" },
    { "name": "meta", "type": "text", "max": 400 },
    { "name": "ctaLabel", "type": "text", "max": 80 },
    { "name": "ctaHref", "type": "text", "max": 400 },
    { "name": "unread", "type": "bool" },
    { "name": "modelPreview", "type": "json", "maxSize": 4000 },
    { "name": "accuracyCompare", "type": "json", "maxSize": 2000 },
    { "name": "statBand", "type": "json", "maxSize": 4000 },
    { "name": "sortOrder", "type": "number" },
    { "name": "created", "type": "autodate", "onCreate": true },
    { "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX `idx_updates_slug` ON `updates` (`slug`)",
    "CREATE INDEX `idx_updates_dayGroup` ON `updates` (`dayGroup`)",
    "CREATE INDEX `idx_updates_kind` ON `updates` (`kind`)"
  ],
  "listRule":   "@request.auth.id != ''",
  "viewRule":   "@request.auth.id != ''",
  "createRule": null,
  "updateRule": null,
  "deleteRule": null
}
JSON
)" > /tmp/pb-coll.json
python3 -c "import json; d=json.load(open('/tmp/pb-coll.json')); print(' ', d.get('message') or 'created')"

# ── Collections (user-created groupings of scans). Slug is unique
#    application-wide so URLs resolve deterministically. Owner-only
#    access for now; relax when collaborators / sharing land.
echo "→ creating collections collection"
curl -s -X POST "$PB_URL/api/collections" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSON
{
  "type": "base",
  "name": "collections",
  "fields": [
    { "name": "userId", "type": "relation", "collectionId": "$USERS_ID", "maxSelect": 1, "required": true, "cascadeDelete": true },
    { "name": "slug", "type": "text", "required": true, "min": 1, "max": 80, "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$" },
    { "name": "title", "type": "text", "required": true, "min": 1, "max": 120 },
    { "name": "description", "type": "text", "max": 500 },
    { "name": "tone", "type": "select", "maxSelect": 1, "required": true, "values": ["human","ai","mixed","info","gold","neutral"] },
    { "name": "pattern", "type": "select", "maxSelect": 1, "required": true, "values": ["dots","grid","lines"] },
    { "name": "pinned", "type": "bool" },
    { "name": "created", "type": "autodate", "onCreate": true },
    { "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX \`idx_collections_slug\` ON \`collections\` (\`slug\`)",
    "CREATE INDEX \`idx_collections_user\` ON \`collections\` (\`userId\`)"
  ],
  "listRule":   "userId = @request.auth.id",
  "viewRule":   "userId = @request.auth.id",
  "createRule": "@request.auth.id != '' && userId = @request.auth.id",
  "updateRule": "userId = @request.auth.id",
  "deleteRule": "userId = @request.auth.id"
}
JSON
)" > /tmp/pb-coll.json
python3 -c "import json; d=json.load(open('/tmp/pb-coll.json')); print(' ', d.get('message') or 'created')"

# ── Service secrets — single-row, superuser-only. Holds the shared
#    Hugging Face Inference API token. The api service reads it via a
#    superuser PB client at scan time. Token is owner-rotated from PB
#    admin UI, no env-var roundtrip needed.
echo "→ creating service_secrets collection"
curl -s -X POST "$PB_URL/api/collections" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(cat <<'JSON'
{
  "type": "base",
  "name": "service_secrets",
  "fields": [
    { "name": "huggingfaceToken", "type": "text", "max": 200, "hidden": true },
    { "name": "created", "type": "autodate", "onCreate": true },
    { "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
  ],
  "listRule":   null,
  "viewRule":   null,
  "createRule": null,
  "updateRule": null,
  "deleteRule": null
}
JSON
)" > /tmp/pb-coll.json
python3 -c "import json; d=json.load(open('/tmp/pb-coll.json')); print(' ', d.get('message') or 'created')"

# ── Detection models — one row per HF model the catalog exposes. Owner
#    edits everything (model id, token cost, plan gating, defaults) via
#    PB admin. Users see enabled rows only and the API hides hfModelId
#    in its response — clients only ever need the slug.
echo "→ creating detection_models collection"
curl -s -X POST "$PB_URL/api/collections" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(cat <<'JSON'
{
  "type": "base",
  "name": "detection_models",
  "fields": [
    { "name": "slug", "type": "text", "required": true, "min": 1, "max": 80 },
    { "name": "name", "type": "text", "required": true, "max": 120 },
    { "name": "type", "type": "select", "maxSelect": 1, "required": true, "values": ["txt","img","aud","vid"] },
    { "name": "hfModelId", "type": "text", "max": 200 },
    { "name": "videoFrameModelSlug", "type": "text", "max": 80 },
    { "name": "videoFrameCount", "type": "number" },
    { "name": "description", "type": "text", "max": 600 },
    { "name": "accuracy", "type": "number", "min": 0, "max": 100 },
    { "name": "getKeyUrl", "type": "url" },
    { "name": "enabled", "type": "bool" },
    { "name": "tokenCost", "type": "number", "required": true, "min": 0 },
    { "name": "costUnit", "type": "select", "maxSelect": 1, "values": ["per_scan","per_minute"] },
    { "name": "plansAllowed", "type": "select", "maxSelect": 4, "values": ["check","verify","certify","team"] },
    { "name": "defaultForPlans", "type": "select", "maxSelect": 4, "values": ["check","verify","certify","team"] },
    { "name": "created", "type": "autodate", "onCreate": true },
    { "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX `idx_detection_models_slug` ON `detection_models` (`slug`)",
    "CREATE INDEX `idx_detection_models_type_enabled` ON `detection_models` (`type`, `enabled`)"
  ],
  "listRule":   "enabled = true && @request.auth.id != ''",
  "viewRule":   "enabled = true && @request.auth.id != ''",
  "createRule": null,
  "updateRule": null,
  "deleteRule": null
}
JSON
)" > /tmp/pb-coll.json
python3 -c "import json; d=json.load(open('/tmp/pb-coll.json')); print(' ', d.get('message') or 'created')"

echo "✓ schema setup complete"
