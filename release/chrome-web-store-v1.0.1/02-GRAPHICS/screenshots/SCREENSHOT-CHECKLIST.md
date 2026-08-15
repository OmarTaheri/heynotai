# Product screenshots — how to capture them

Chrome Web Store requires at least one real screenshot of the working
extension, at **exactly 1280×800 or 640×400**, PNG or JPEG, no alpha channel,
maximum five. 1280×800 PNG is the right choice here. A generated mockup is not
acceptable as a product screenshot.

Because the heynotai drawer and the result badge are injected into the page
itself, a plain page-viewport capture contains the whole product UI. That is
what makes the DevTools method below work.

## Setup (once)

1. Load `03-LOCAL-TEST/chrome-load-unpacked` through `chrome://extensions` →
   Developer mode → **Load unpacked**. That build points at the production API,
   so the results in the screenshots are real. (Do not use the extracted store
   ZIP for this — it has no manifest key, so Chrome gives it a random ID that
   the API's `EXTENSION_IDS` allowlist will reject at sign-in.)
2. Sign in with an account whose history you are willing to show publicly.
   Easiest is the reviewer account from `01-STORE-LISTING/test-instructions.md`.
3. Create a clean Chrome profile, or hide the bookmarks bar and other
   extensions — anything in frame becomes part of your store listing.

## Capturing at exactly 1280×800

Screen-grabbing on a HiDPI laptop produces the wrong pixel dimensions, so drive
it from DevTools instead:

1. Open the page you want to show and press `Ctrl+0` to reset page zoom.
2. `F12` → `Ctrl+Shift+M` to turn on the device toolbar.
3. In the device dropdown choose **Responsive**, then type `1280` × `800`.
4. In the device toolbar's `⋮` menu enable **Add device pixel ratio**, and set
   DPR to `1`. Without this you get a 2560×1600 image on a retina display.
5. Run the scan and wait for the verdict to render.
6. `Ctrl+Shift+P` → type `Capture screenshot` → Enter. DevTools itself is never
   in the image.
7. Save into this folder with the names listed below.

If a shot must be taken outside DevTools, capture larger and downscale, then
verify the dimensions before uploading:

```powershell
Add-Type -AssemblyName System.Drawing; Get-ChildItem *.png | ForEach-Object { $img = [System.Drawing.Image]::FromFile($_.FullName); "$($_.Name): $($img.Width)x$($img.Height)"; $img.Dispose() }
```

## The set to capture

1. `01-text-scan-result-1280x800.png` — text selected on a public article, the
   right-click check run, verdict drawer open. This is the hero image; it shows
   the whole value of the product in one frame, so put it first.
2. `02-image-scan-result-1280x800.png` — an image result, on content you own or
   are licensed to show.
3. `03-video-scan-result-1280x800.png` — a supported video result with the
   on-page badge visible.
4. `04-recent-scans-1280x800.png` — the history view, seeded with innocuous
   scans only.
5. `05-settings-1280x800.png` — the automatic-detection and platform toggles,
   which is where reviewers look to confirm the broad host permission is
   user-controlled. Worth including for that reason alone.

## Before uploading

- No email addresses, tokens, private URLs, real names, or personal history in
  frame — including in the browser's own UI.
- Only content you own or may show. On third-party platforms, keep other
  people's posts, comments, and avatars out of frame.
- Do not present the extension as affiliated with YouTube, Instagram, Meta, or
  Google; showing that heynotai works on those pages is fine, borrowing their
  branding is not.
- No invented ratings, awards, user counts, or accuracy claims you cannot
  support.
- Keep the drawer large and legible; avoid heavy text overlays.
- Re-verify every file is exactly 1280×800 (or 640×400) before upload.
