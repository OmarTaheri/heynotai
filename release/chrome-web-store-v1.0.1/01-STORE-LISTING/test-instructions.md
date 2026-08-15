# Chrome Web Store reviewer instructions

The dashboard's **Test instructions** tab has three fields: Username (100
chars), Password (100 chars), and Additional instructions (500 chars). Paste
the blocks below.

## Create the reviewer account first

The credentials must be real and must work on production. Seed the account
after the API is deployed:

```
docker exec -it \
  -e REVIEWER_EMAIL=chrome-review@heynotai.com \
  -e REVIEWER_PASSWORD='<see reviewer-credentials.secret.md>' \
  heynotai-api node scripts/seed-reviewer.mjs
```

`api/scripts/seed-reviewer.mjs` creates the account with `email_verified` set,
`system_role = 'user'`, and plan `certify` — the plan matters, because a new
account lands on `check` (100 tokens/month, below the higher-tier detection
models) and a reviewer who hits a quota wall files a rejection. Email
verification does not gate sign-in, so no mailbox access is needed. Re-run the
same command any time to rotate the password.

Then sign in once yourself from the unpacked build and run one text check, to
confirm the exact path the reviewer will take.

## Username and password

Both are in `reviewer-credentials.secret.md` in this folder, which `.gitignore`
keeps out of the repository. Username is `chrome-review@heynotai.com`; the
password lives only in that file and in the dashboard.

## Additional instructions (494 / 500 characters)

```
1. Click the heynotai toolbar icon, then Sign in. A window opens heynotai.com; enter the credentials above and it returns automatically.
2. Highlight a paragraph on any article, right-click, choose "AI check this text with heynotai".
3. The drawer shows the AI verdict and confidence; the check also appears under Recent.
4. For video, open a YouTube watch page and use the same right-click menu.
Settings > Sources controls where automatic checking runs. Audio checking is off in this release.
```

Why these four steps: sign-in is the gate in front of every other feature, the
text check is the core function, the drawer is where the result appears, and
the video path exercises the platform integrations. The closing line points at
the setting that shows the `<all_urls>` permission is user-controlled, which is
the question the host-permission reviewer is actually asking.

## Longer manual (for your own pre-submit pass, not for the form)

1. Install the extension and select its toolbar icon.
2. Choose **Sign in**. A `chrome.identity` window opens
   `https://heynotai.com/extension-auth`, which bounces to the website's login
   modal, then hands a one-time code back to the extension.
3. Confirm the account stays signed in after closing and reopening the drawer.
4. Select text on a normal HTTPS page, right-click, run the text check.
5. Confirm a verdict and confidence score appear and the check lands in Recent.
6. Test one supported image and one supported video.
7. Toggle automatic detection, refresh a supported page, confirm the behavior
   changes.
8. Sign out and confirm protected actions ask for sign-in again.

## Notes

- An internet connection is required.
- The extension talks to `https://api.heynotai.com` and `https://heynotai.com`.
- Detection is probabilistic and may return human, AI, or mixed.
- Audio detection is intentionally unavailable in this release.
- Do not submit local-development credentials or an administrator account.
