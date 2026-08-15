# heynotai Chrome Web Store release kit — 1.0.1

This folder contains the production extension package, Chrome Web Store copy,
privacy declarations, promotional graphics, and an unpacked build for local testing.

## Before you upload

1. Confirm `https://heynotai.com` and `https://api.heynotai.com` are live over
   HTTPS **and running the current PostgreSQL-backed API**. Check
   `https://api.heynotai.com/health`: it must report `services.database`, not
   `pocketbase`. The extension's sign-in flows call `/auth/*` on the API and
   `/extension-auth` on the website; neither exists on the retired build.
2. Confirm the API's `EXTENSION_IDS` allowlist contains **both** the
   store-assigned ID `dmnmdeccfhicgfjmcehkmpkfpakccbkj` and the local-test
   build's pinned ID `blffhfijmlabjphlccpmdhjkninakchg` — see **Extension IDs**
   below.
3. Confirm `https://heynotai.com/privacy` and
   `https://heynotai.com/extension-auth` are deployed.
4. Test sign-in and one text, image, and video scan using the unpacked build in
   `03-LOCAL-TEST/chrome-load-unpacked`.
5. Capture at least one real 1280×800 screenshot by following
   `02-GRAPHICS/screenshots/SCREENSHOT-CHECKLIST.md`.
6. Create a real production reviewer account, then replace every
   `REPLACE BEFORE SUBMIT` marker in `01-STORE-LISTING/test-instructions.md`.

## Upload in Chrome Web Store Developer Dashboard

1. Open the Developer Dashboard and select **Add new item**.
2. Upload `00-UPLOAD-FIRST/heynotai-1.0.1-chrome.zip`.
3. In **Store listing**, paste `01-STORE-LISTING/listing-copy.md` and upload the
   icon, screenshots, and promotional images from `02-GRAPHICS`.
4. In **Privacy practices**, paste the single-purpose and permission answers from
   `01-STORE-LISTING/privacy-practices.md`. Enter
   `https://heynotai.com/privacy` as the privacy-policy URL.
5. In **Distribution**, choose the intended visibility and countries. Public is
   the normal choice for a customer product.
6. In **Test instructions**, paste `01-STORE-LISTING/test-instructions.md` and
   provide the production reviewer credentials.
7. Save the draft, use the dashboard preview, fix every warning, and submit for review.

Do not upload the whole release-kit folder. Upload only the ZIP inside
`00-UPLOAD-FIRST`.

## Extension IDs

Production ZIPs ship **without** a `manifest.key`: the Chrome Web Store rejects
any upload that carries one ("key field is not allowed in manifest"), so it
assigns its own extension ID at first upload. Only the dev and local-test
builds keep the pinned key, which is why they are always
`blffhfijmlabjphlccpmdhjkninakchg`.

The store assigned: **`dmnmdeccfhicgfjmcehkmpkfpakccbkj`**

Both IDs must be in the production API's `EXTENSION_IDS`, comma-separated:

```
EXTENSION_IDS=dmnmdeccfhicgfjmcehkmpkfpakccbkj,blffhfijmlabjphlccpmdhjkninakchg
```

Sign-in redirects to `https://<extension-id>.chromiumapp.org/website-auth`, and
the API rejects any ID missing from that list — the published extension cannot
sign in until this is set. Google Cloud needs no change; it only ever sees the
API's own `GOOGLE_REDIRECT_URI`.

The privacy-policy draft is practical release copy, not legal advice. Review it
against your actual production data flow before publishing.
