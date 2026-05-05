#!/bin/bash
# Seed the `updates` collection with the same content that previously
# lived in frontend/lib/updates-data.ts. Idempotent: uses `slug` as a
# stable key — re-running upserts (delete-then-create) so edits made in
# the admin UI are NOT clobbered unless you run this script again.
#
# Usage:  bash pocketbase/seed-updates.sh [admin-email] [admin-password]

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

# Upsert one record. Looks up by slug, deletes if found, then creates.
upsert() {
  local PAYLOAD="$1"
  local SLUG=$(echo "$PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin)['slug'])")
  # Find existing
  EXISTING_ID=$(curl -s -G "$PB_URL/api/collections/updates/records" \
    -H "Authorization: $TOKEN" \
    --data-urlencode "filter=slug='$SLUG'" \
    | python3 -c "import sys, json; d=json.load(sys.stdin); items=d.get('items',[]); print(items[0]['id'] if items else '')")
  if [ -n "$EXISTING_ID" ]; then
    curl -s -X DELETE "$PB_URL/api/collections/updates/records/$EXISTING_ID" \
      -H "Authorization: $TOKEN" > /dev/null
  fi
  curl -s -X POST "$PB_URL/api/collections/updates/records" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > /tmp/pb-rec.json
  python3 -c "import json; d=json.load(open('/tmp/pb-rec.json')); print('  ', d.get('slug') or d.get('message','?'))"
}

echo "→ seeding updates"

upsert "$(cat <<'JSON'
{
  "slug": "u-gpt5-turbo",
  "kind": "new-model",
  "contentType": "txt",
  "dayGroup": "this-week",
  "timestamp": "2 days ago · Apr 22",
  "publishedAt": "2026-04-22 00:00:00",
  "title": "GPT-5 <em>turbo</em> detection shipped",
  "description": "OpenAI released GPT-5 turbo last week. We've trained our text detector on <strong>14,000 sample outputs</strong> and shipped support today. Detection is auto-enabled on all accounts — your existing scans can be re-run for free.",
  "meta": "<strong>21</strong> matches in your scans · 30d",
  "ctaLabel": "Re-scan with new model",
  "ctaHref": "/app/library",
  "unread": true,
  "modelPreview": { "vendor": "openai", "initials": "G5", "name": "GPT-5 turbo", "metaLine": "OpenAI · TEXT · trained Apr 19", "accuracy": 94 },
  "sortOrder": 1
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "u-pixel-forensics",
  "kind": "accuracy",
  "contentType": "img",
  "dayGroup": "this-week",
  "timestamp": "2 days ago · Apr 22",
  "publishedAt": "2026-04-22 00:00:00",
  "title": "Pixel Forensics — <em>Midjourney v7 detection improved</em>",
  "description": "After analyzing <strong>40,000 newly tagged samples</strong>, we re-trained Pixel Forensics on Midjourney v7 outputs. False-positive rate dropped from <strong>7.2%</strong> to <strong>2.8%</strong>, and overall accuracy rose 4 points.",
  "meta": "Affects <strong>Pixel Forensics v2</strong> · auto-applied",
  "ctaLabel": "View benchmark",
  "ctaHref": "/app/models",
  "unread": true,
  "accuracyCompare": { "beforeLabel": "Before", "before": 89, "afterLabel": "After", "after": 93 },
  "sortOrder": 2
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "u-bulk-rescan",
  "kind": "product",
  "dayGroup": "this-week",
  "timestamp": "3 days ago · Apr 21",
  "publishedAt": "2026-04-21 00:00:00",
  "title": "Bulk re-scan from <em>any collection</em>",
  "description": "You can now re-scan an entire collection with your current engine selection. Useful when you switch from <em>Atlas Lite</em> to <em>Atlas Pro</em> and want to re-verify earlier work, or after we ship a new model.",
  "meta": "Available on all plans",
  "ctaLabel": "Open Collections",
  "ctaHref": "/app/collections",
  "unread": true,
  "statBand": [
    { "label": "Re-scan", "value": "1-click" },
    { "label": "Tokens", "value": "Pooled" },
    { "label": "For new models", "value": "Free", "tone": "up" }
  ],
  "sortOrder": 3
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "u-veo-3",
  "kind": "new-model",
  "contentType": "vid",
  "dayGroup": "last-week",
  "timestamp": "5 days ago · Apr 19",
  "publishedAt": "2026-04-19 00:00:00",
  "title": "Veo 3 detection — <em>still in beta</em>",
  "description": "Google released Veo 3 last month. We're catching about <strong>82%</strong> of outputs, which is below our 87% threshold for full support — but we know users need it now, so it's available as <em>beta</em>. Expect false negatives on shorter clips.",
  "meta": "Off by default · enable in <strong>Models</strong>",
  "ctaLabel": "Read methodology",
  "ctaHref": "/app/models",
  "modelPreview": { "vendor": "google", "initials": "V3", "name": "Veo 3", "metaLine": "Google DeepMind · VIDEO · beta", "accuracy": 82, "warn": true },
  "sortOrder": 4
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "u-telegram-monitors",
  "kind": "product",
  "dayGroup": "last-week",
  "timestamp": "6 days ago · Apr 18",
  "publishedAt": "2026-04-18 00:00:00",
  "title": "Telegram channel monitors",
  "description": "You can now set up monitors on public Telegram channels. Same alerting rules, same dashboard. <strong>Pro and Team plans only.</strong>",
  "meta": "New monitor type · 6 templates updated",
  "ctaLabel": "Create monitor",
  "ctaHref": "/app/monitors",
  "sortOrder": 5
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "u-flux-1-2-pro",
  "kind": "new-model",
  "contentType": "img",
  "dayGroup": "last-week",
  "timestamp": "1 week ago · Apr 17",
  "publishedAt": "2026-04-17 00:00:00",
  "title": "FLUX <em>1.2 pro</em> support",
  "description": "Black Forest Labs shipped FLUX 1.2 pro on April 12. We added detection three days later. Auto-enabled.",
  "meta": "Auto-enabled · 0 matches in your scans yet",
  "ctaLabel": "View in Models",
  "ctaHref": "/app/models",
  "modelPreview": { "vendor": "flux", "initials": "F2", "name": "FLUX 1.2 pro", "metaLine": "Black Forest Labs · IMAGE", "accuracy": 90 },
  "sortOrder": 6
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "u-reddit-fix",
  "kind": "fix",
  "dayGroup": "last-week",
  "timestamp": "1 week ago · Apr 17",
  "publishedAt": "2026-04-17 00:00:00",
  "title": "Extension stopped scanning long Reddit threads",
  "description": "The Chrome extension was timing out on Reddit threads with more than 200 comments. Fixed — the extension now chunks long pages and reports per-thread verdicts instead of failing silently.",
  "meta": "Extension v2.4.1 · auto-updated",
  "sortOrder": 7
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "u-vocal-print-v2",
  "kind": "accuracy",
  "contentType": "aud",
  "dayGroup": "earlier-april",
  "timestamp": "2 weeks ago · Apr 11",
  "publishedAt": "2026-04-11 00:00:00",
  "title": "Vocal Print <em>v2</em> released",
  "description": "A full rewrite of our voice-cloning detector. Better at catching ElevenLabs v3, Play.ht 3.0, and Resemble's latest. Spectral fingerprinting now runs on shorter clips (down to <strong>3 seconds</strong>, was <strong>10s</strong>).",
  "meta": "Auto-applied to all audio scans",
  "ctaLabel": "View detector page",
  "ctaHref": "/app/models",
  "accuracyCompare": { "beforeLabel": "v1", "before": 81, "afterLabel": "v2", "after": 89 },
  "sortOrder": 8
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "u-byok-sightengine",
  "kind": "product",
  "dayGroup": "earlier-april",
  "timestamp": "3 weeks ago · Apr 4",
  "publishedAt": "2026-04-04 00:00:00",
  "title": "BYOK for image detection — <em>Sightengine integration</em>",
  "description": "Bring your own Sightengine API key for image scans. We charge zero tokens — you pay Sightengine directly at their rates. Useful if you already have an enterprise contract or want absolute cost control.",
  "meta": "Engines page · Image section",
  "ctaLabel": "Configure",
  "ctaHref": "/app/models",
  "sortOrder": 9
}
JSON
)"

echo "✓ updates seeded"
