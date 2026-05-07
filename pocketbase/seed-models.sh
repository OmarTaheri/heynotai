#!/bin/bash
# Seed `detection_models` with the Hugging Face Inference API model
# catalog, plus an empty `service_secrets` row for the owner to paste
# the HF token into via PB admin UI.
#
# Idempotent: detection_models rows are upserted by slug; the
# service_secrets row is only inserted if the collection is empty
# (so an already-set HF token is never wiped out).
#
# Usage:  bash pocketbase/seed-models.sh [admin-email] [admin-password]

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

# Upsert one detection_models row by slug. Logs HTTP status + slug or
# error so silent insert failures (e.g. schema field missing on a stale
# pb_data volume) show up in `docker logs` instead of leaving the
# collection partially seeded.
upsert() {
  local PAYLOAD="$1"
  local SLUG=$(echo "$PAYLOAD" | python3 -c "import sys, json; print(json.load(sys.stdin)['slug'])")
  EXISTING_ID=$(curl -s -G "$PB_URL/api/collections/detection_models/records" \
    -H "Authorization: $TOKEN" \
    --data-urlencode "filter=slug='$SLUG'" \
    | python3 -c "import sys, json; d=json.load(sys.stdin); items=d.get('items',[]); print(items[0]['id'] if items else '')")
  if [ -n "$EXISTING_ID" ]; then
    curl -s -X DELETE "$PB_URL/api/collections/detection_models/records/$EXISTING_ID" \
      -H "Authorization: $TOKEN" > /dev/null
  fi
  HTTP_CODE=$(curl -s -o /tmp/pb-rec.json -w '%{http_code}' \
    -X POST "$PB_URL/api/collections/detection_models/records" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "   ✓ $SLUG"
  else
    echo "   ✗ $SLUG (HTTP $HTTP_CODE)"
    cat /tmp/pb-rec.json 2>/dev/null
    echo
  fi
}

echo "→ seeding detection_models"

# ── Text detectors ────────────────────────────────────────────────────
upsert "$(cat <<'JSON'
{
  "slug": "fakespot-roberta",
  "name": "Fakespot AI Detector",
  "type": "txt",
  "hfModelId": "fakespot-ai/roberta-base-ai-text-detection-v1",
  "description": "RoBERTa-based detector trained on a broad mix of human and AI text. A solid general-purpose pick.",
  "accuracy": 91,
  "getKeyUrl": "https://huggingface.co/fakespot-ai/roberta-base-ai-text-detection-v1",
  "enabled": true,
  "tokenCost": 1,
  "costUnit": "per_scan",
  "tier": "check",
  "plansAllowed": ["check","verify","certify","team"],
  "defaultForPlans": ["check","verify","certify","team"]
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "openai-roberta",
  "name": "OpenAI RoBERTa Detector",
  "type": "txt",
  "hfModelId": "openai-community/roberta-base-openai-detector",
  "description": "OpenAI's classic RoBERTa-based GPT-2 detector. Useful as a baseline; weaker on newer LLMs.",
  "accuracy": 84,
  "getKeyUrl": "https://huggingface.co/openai-community/roberta-base-openai-detector",
  "enabled": true,
  "tokenCost": 4,
  "costUnit": "per_scan",
  "tier": "certify",
  "plansAllowed": ["certify","team"],
  "defaultForPlans": []
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "simpleai-chatgpt",
  "name": "SimpleAI ChatGPT Detector",
  "type": "txt",
  "hfModelId": "Hello-SimpleAI/chatgpt-detector-roberta",
  "description": "Tuned specifically against ChatGPT outputs. High recall on GPT-family text.",
  "accuracy": 89,
  "getKeyUrl": "https://huggingface.co/Hello-SimpleAI/chatgpt-detector-roberta",
  "enabled": true,
  "tokenCost": 2,
  "costUnit": "per_scan",
  "tier": "verify",
  "plansAllowed": ["verify","certify","team"],
  "defaultForPlans": []
}
JSON
)"

# ── Image detectors ───────────────────────────────────────────────────
upsert "$(cat <<'JSON'
{
  "slug": "deepfake-v2",
  "name": "Deep-Fake Detector v2",
  "type": "img",
  "hfModelId": "prithivMLmods/Deep-Fake-Detector-v2-Model",
  "description": "ViT-based deepfake detector. Reports ~92% accuracy on standard benchmarks.",
  "accuracy": 92,
  "getKeyUrl": "https://huggingface.co/prithivMLmods/Deep-Fake-Detector-v2-Model",
  "enabled": true,
  "tokenCost": 2,
  "costUnit": "per_scan",
  "tier": "check",
  "plansAllowed": ["check","verify","certify","team"],
  "defaultForPlans": ["check","verify","certify","team"]
}
JSON
)"

# Disabled: HF's free serverless (`hf-inference`) does not host the ONNX
# runtime — calling this model returns 400 "Model not supported by
# provider hf-inference". Re-enable only if we wire a paid Inference
# Endpoint with onnxruntime support.
upsert "$(cat <<'JSON'
{
  "slug": "deepfake-v2-onnx",
  "name": "Deep-Fake Detector v2 (ONNX)",
  "type": "img",
  "hfModelId": "onnx-community/Deep-Fake-Detector-v2-Model-ONNX",
  "description": "ONNX-quantized variant of Deep-Fake v2. Disabled — HF free serverless does not host the ONNX runtime. Needs a paid Inference Endpoint to enable.",
  "accuracy": 91,
  "getKeyUrl": "https://huggingface.co/onnx-community/Deep-Fake-Detector-v2-Model-ONNX",
  "enabled": false,
  "tokenCost": 2,
  "costUnit": "per_scan",
  "tier": "check",
  "plansAllowed": ["check","verify","certify","team"],
  "defaultForPlans": []
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "vit-deepfake",
  "name": "ViT Deepfake Detection",
  "type": "img",
  "hfModelId": "Wvolf/ViT_Deepfake_Detection",
  "description": "Vision Transformer fine-tuned for deepfake detection. Reports 98.7% on its evaluation set.",
  "accuracy": 98,
  "getKeyUrl": "https://huggingface.co/Wvolf/ViT_Deepfake_Detection",
  "enabled": true,
  "tokenCost": 8,
  "costUnit": "per_scan",
  "tier": "certify",
  "plansAllowed": ["certify","team"],
  "defaultForPlans": []
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "siglip2-deepfake",
  "name": "Deepfake Detect SigLIP2",
  "type": "img",
  "hfModelId": "prithivMLmods/Deepfake-Detect-Siglip2",
  "description": "SigLIP2-backbone deepfake detector. Newer architecture, strong on stylized AI imagery.",
  "accuracy": 94,
  "getKeyUrl": "https://huggingface.co/prithivMLmods/Deepfake-Detect-Siglip2",
  "enabled": true,
  "tokenCost": 4,
  "costUnit": "per_scan",
  "tier": "verify",
  "plansAllowed": ["verify","certify","team"],
  "defaultForPlans": []
}
JSON
)"

# ── Audio detectors ───────────────────────────────────────────────────
# Routed through Modulate Velma (provider: "velma") because HF's free
# serverless tier doesn't host audio-classification models. Velma is
# #1 on the HF Speech Deepfake Arena leaderboard (1.1% EER) and ships
# with 1,000 free API credits on signup ($0.25/hr of audio after that).
# The operator pastes their Velma API key in the PB admin UI under
# `service_secrets.velmaApiKey`.
upsert "$(cat <<'JSON'
{
  "slug": "modulate-velma",
  "name": "Modulate Velma Deepfake",
  "type": "aud",
  "provider": "velma",
  "hfModelId": "",
  "description": "Modulate Velma Deepfake Detect — #1 on the HF Speech Deepfake Arena. 1,000 free API credits on signup, then $0.25/hour of audio. Provides per-segment probability scores collapsed to a single verdict.",
  "accuracy": 99,
  "getKeyUrl": "https://www.modulate.ai/api/deepfake-detection-model",
  "enabled": true,
  "tokenCost": 12,
  "costUnit": "per_scan",
  "tier": "check",
  "plansAllowed": ["check","verify","certify","team"],
  "defaultForPlans": ["check","verify","certify","team"]
}
JSON
)"

# ── Video meta-detectors (sample frames, run image model per frame) ──
upsert "$(cat <<'JSON'
{
  "slug": "frames-deepfake-v2",
  "name": "Frame-by-frame Deep-Fake v2",
  "type": "vid",
  "hfModelId": "",
  "videoFrameModelSlug": "deepfake-v2",
  "videoFrameCount": 16,
  "description": "Samples 16 evenly-spaced frames from the video and runs Deep-Fake Detector v2 on each, then aggregates.",
  "accuracy": 88,
  "getKeyUrl": "https://huggingface.co/prithivMLmods/Deep-Fake-Detector-v2-Model",
  "enabled": true,
  "tokenCost": 8,
  "costUnit": "per_minute",
  "tier": "check",
  "plansAllowed": ["check","verify","certify","team"],
  "defaultForPlans": ["check","verify","certify","team"]
}
JSON
)"

upsert "$(cat <<'JSON'
{
  "slug": "frames-vit-deepfake",
  "name": "Frame-by-frame ViT Deepfake",
  "type": "vid",
  "hfModelId": "",
  "videoFrameModelSlug": "vit-deepfake",
  "videoFrameCount": 16,
  "description": "Samples 16 frames and runs the ViT_Deepfake_Detection image model on each, then aggregates.",
  "accuracy": 92,
  "getKeyUrl": "https://huggingface.co/Wvolf/ViT_Deepfake_Detection",
  "enabled": true,
  "tokenCost": 12,
  "costUnit": "per_minute",
  "tier": "team",
  "plansAllowed": ["team"],
  "defaultForPlans": []
}
JSON
)"

# ── service_secrets — only insert if the collection is empty so a
#    previously-saved HF token isn't wiped on re-seed.
echo "→ ensuring service_secrets row exists"
EXISTING_SECRETS=$(curl -s -G "$PB_URL/api/collections/service_secrets/records" \
  -H "Authorization: $TOKEN" \
  --data-urlencode "perPage=1" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('items',[])))")
if [ "$EXISTING_SECRETS" = "0" ]; then
  curl -s -X POST "$PB_URL/api/collections/service_secrets/records" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{ "huggingfaceToken": "", "velmaApiKey": "" }' > /tmp/pb-rec.json
  python3 -c "import json; d=json.load(open('/tmp/pb-rec.json')); print('   created — paste your HF token + Modulate Velma API key in PB admin')"
else
  echo "   already populated — leaving existing token in place"
fi

echo "✓ models seed complete"
