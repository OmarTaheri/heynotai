# Test heynotai on your computer

## Load the unpacked extension

1. Open Google Chrome.
2. Enter `chrome://extensions` in the address bar.
3. Turn on **Developer mode** in the upper-right corner.
4. Select **Load unpacked**.
5. Choose this folder:
   `03-LOCAL-TEST/chrome-load-unpacked`
6. Pin heynotai from Chrome's Extensions menu.
7. Confirm the ID shown on the extension card is
   `blffhfijmlabjphlccpmdhjkninakchg`.

## Functional test

1. Select the heynotai toolbar icon and sign in.
2. Confirm website sign-in returns to the extension and the account state stays signed in after closing and reopening the drawer.
3. Select text on a normal HTTPS webpage, right-click it, and run the heynotai scan.
4. Confirm a verdict and confidence score appear and the scan appears in recent history.
5. Test one supported image and one supported video.
6. Toggle automatic detection in settings, refresh a supported page, and confirm its behavior changes.
7. Sign out and confirm protected scans/actions ask you to sign in again.

## Inspect errors

- On `chrome://extensions`, select **Service worker** under heynotai to inspect background logs.
- Right-click the extension drawer and choose **Inspect** for its console and network requests.
- A `Failed to fetch` error usually means the production API hostname is not live, TLS is invalid, or API CORS does not allow the extension origin.

## After changing extension code

Run the production build again, then select **Reload** on the extension card in `chrome://extensions`. Chrome does not automatically reload the unpacked extension after a rebuild.

## Test the exact ZIP

The Chrome Web Store accepts a ZIP, but **Load unpacked** requires a folder. To verify the exact upload package, extract `00-UPLOAD-FIRST/heynotai-1.0.1-chrome.zip` into a new folder, then load that extracted folder through `chrome://extensions`.

The store ZIP ships without a manifest key (the store rejects uploads that have one), so Chrome assigns the extracted folder a **random ID** rather than `blffhfijmlabjphlccpmdhjkninakchg`. Everything works except sign-in, which the API rejects with `invalid_extension_redirect` because that random ID is not in `EXTENSION_IDS`. Use this only to confirm the package loads and the UI renders; do functional and sign-in testing with `chrome-load-unpacked`.
