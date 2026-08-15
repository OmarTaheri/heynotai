# Blocking checks before Chrome Web Store submission

Last reviewed: August 15, 2026.

## Cleared

- `https://api.heynotai.com/health` — HTTP 200 (checked August 14).
- Upload package — `00-UPLOAD-FIRST/heynotai-1.0.1-chrome.zip` rebuilt without
  `manifest.key`, which the store rejects. Verified: the ZIP's manifest has no
  `key` field.
- Privacy policy content — `frontend/app/privacy/page.tsx` exists, typechecks,
  and renders correctly. It now names IP address and user agent explicitly so
  it matches the Location disclosure in the dashboard.
- Privacy practices answers — final text in
  `01-STORE-LISTING/privacy-practices.md`, every field within its 1000-char
  limit.
- Screenshot capture method — documented in
  `02-GRAPHICS/screenshots/SCREENSHOT-CHECKLIST.md`.

## Still blocking

1. **Deploy the frontend.** `https://heynotai.com/privacy` and
   `https://heynotai.com/extension-auth` both 404 in production. The privacy
   URL is checked by the dashboard, and `/extension-auth` is the entire
   extension sign-in flow — a reviewer hits it on step 1.
2. **Capture the product screenshots.** At least one, ideally five, at exactly
   1280×800. None exist yet.
3. **Seed the reviewer account** on the deployed API:
   `docker exec -it -e REVIEWER_EMAIL=... -e REVIEWER_PASSWORD=... heynotai-api
   node scripts/seed-reviewer.mjs`. Credentials are in
   `01-STORE-LISTING/reviewer-credentials.secret.md` (git-ignored).
4. **Set `EXTENSION_IDS`** on the production API to
   `dmnmdeccfhicgfjmcehkmpkfpakccbkj,blffhfijmlabjphlccpmdhjkninakchg` — the
   store-assigned ID plus the local-test ID. Without the first one the
   published extension cannot sign in. Full env list in `deploy/COOLIFY.md`.

## Worth doing, not blocking

- Self-host the Inter and JetBrains Mono webfonts. `styles/fonts.css` imports
  them from `fonts.googleapis.com`, so opening the drawer sends a request to
  Google. Not remote code, so it does not change the remote-code answer.
- Confirm `support@heynotai.io` is a real, monitored mailbox — it is the
  contact address in the privacy policy, on a different TLD from the product
  domain.
