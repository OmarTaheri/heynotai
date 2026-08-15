import type { Page } from '@playwright/test';
import {
  createTextScan,
  deleteScan,
  loginDevUser,
  type DevSession,
} from './api';
import { expect, seedAuth, seedPrefs, test } from './fixtures';

/** What the drawer actually shows.
 *
 *  These load `drawer.html` directly — the same document the injected
 *  iframe points at. The regression they guard is the fixture era: the
 *  drawer used to render six invented scans to signed-out visitors and
 *  invented signal rows ("Voice cloning · ElevenLabs-like · 84% conf")
 *  for every scan. So: with no session there must be an empty state,
 *  and with a session the rows must be exactly what the API holds.
 *
 *  Playwright cannot intercept an extension page's own fetches, so the
 *  signed-in specs run against a live API and skip themselves when one
 *  isn't reachable. */

let session: DevSession | null = null;
const createdScanIds: string[] = [];

test.beforeAll(async () => {
  session = await loginDevUser();
});

test.afterAll(async () => {
  if (!session) return;
  for (const id of createdScanIds) await deleteScan(session, id);
});

async function openDrawer(page: Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/drawer.html?tabId=1`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('button.tab').first()).toBeVisible({
    timeout: 20_000,
  });
}

const tab = (page: Page, name: string) =>
  page.locator('button.tab', { hasText: name });

/* ── Signed out ──────────────────────────────────────────────────── */

test('signed out, the account panel offers website sign-in and collects nothing', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await openDrawer(page, extensionId);
  await page.locator('button.icon-btn[aria-label="Account"]').click();

  await expect(page.getByText('Sign in on heynotai.com')).toBeVisible({
    timeout: 15_000,
  });

  // The extension must never be a second place credentials are typed.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);

  await page.close();
});

test('signed out, the content tab shows an empty state — not sample scans', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await openDrawer(page, extensionId);
  await tab(page, 'Content').click();

  // Six fabricated rows used to render here for signed-out visitors,
  // complete with author names, scores, and model attributions.
  await expect(page.getByText('Mira Okafor')).toHaveCount(0);
  await expect(page.getByText('GPT-4o (est.)')).toHaveCount(0);
  await expect(page.getByText('SDXL / Midjourney')).toHaveCount(0);

  // The filter chips count what is actually there: nothing.
  await expect(page.getByText('All · 0')).toBeVisible({ timeout: 15_000 });

  await page.close();
});

test('signed out, the sources tab keeps a real allow-list, not seeded hosts', async ({
  context,
  extensionId,
  worker,
}) => {
  await seedPrefs(worker, {
    scanMode: 'allowlist',
    platforms: {
      youtube: { enabled: true, surfaces: { videos: true, reels: true } },
    },
    sites: [],
    flags: {},
  });

  const page = await context.newPage();
  await openDrawer(page, extensionId);
  await tab(page, 'Sources').click();

  // "Sites (0)" — the list used to ship with six invented hosts, each
  // carrying an invented scan count that never moved.
  await expect(page.getByText(/Sites \(0\)/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('streamline.app')).toHaveCount(0);
  await expect(page.getByText('news.example')).toHaveCount(0);

  await page.close();
});

/* ── Signed in (needs a live API) ────────────────────────────────── */

test('signed in, the content tab lists the user\'s real scans', async ({
  context,
  extensionId,
  worker,
}) => {
  test.skip(!session, 'needs a local API — start it with `pnpm dev:api`');
  const active = session!;

  const title = `E2E drawer check ${Date.now()}`;
  const created = await createTextScan(
    active,
    title,
    'In today\'s rapidly evolving landscape, it is important to recognize that leveraging synergistic frameworks fundamentally transforms how organizations approach their strategic initiatives across the enterprise.',
  );
  expect(created, 'scan creation should succeed').not.toBeNull();
  createdScanIds.push(created!.id);

  await seedAuth(worker, {
    token: active.token,
    userId: active.userId,
    plan: active.plan,
    email: active.email,
  });

  const page = await context.newPage();
  await openDrawer(page, extensionId);
  await tab(page, 'Content').click();

  // The scan we just created, by its real title, from the real API.
  await expect(page.getByText(title)).toBeVisible({ timeout: 25_000 });

  // Every row is a real record — the mock rows are gone for good.
  await expect(page.getByText('Mira Okafor')).toHaveCount(0);

  await page.close();
});

test('signed in, the account panel reports real usage instead of "coming soon"', async ({
  context,
  extensionId,
  worker,
}) => {
  test.skip(!session, 'needs a local API — start it with `pnpm dev:api`');
  const active = session!;

  await seedAuth(worker, {
    token: active.token,
    userId: active.userId,
    plan: active.plan,
    email: active.email,
  });

  const page = await context.newPage();
  await openDrawer(page, extensionId);
  await page.locator('button.icon-btn[aria-label="Account"]').click();

  // "<used> / <limit>" from GET /me/usage, rendered alongside the reset
  // hint in one row. The row was a hard-coded em-dash captioned
  // "Tracking coming soon".
  await expect(page.getByText(/\d[\d,]*\s*\/\s*\d[\d,]*/)).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByText(/resets/i)).toBeVisible();
  await expect(page.getByText('Tracking coming soon')).toHaveCount(0);

  // Signing out is a website action, and the button says so.
  await expect(
    page.getByRole('button', { name: /sign out on heynotai\.com/i }),
  ).toBeVisible();

  await page.close();
});

test('signed in, a platform toggle reaches the storage the scanner gates on', async ({
  context,
  extensionId,
  worker,
}) => {
  test.skip(!session, 'needs a local API — start it with `pnpm dev:api`');
  const active = session!;

  await seedAuth(worker, {
    token: active.token,
    userId: active.userId,
    plan: active.plan,
    email: active.email,
  });
  await seedPrefs(worker, {
    scanMode: 'allowlist',
    platforms: {
      youtube: { enabled: true, surfaces: { videos: true, reels: true } },
    },
    sites: [],
    flags: {},
  });

  const page = await context.newPage();
  await openDrawer(page, extensionId);
  await tab(page, 'Sources').click();

  const youtube = page.locator('button.toggle[aria-label="YouTube"]');
  await expect(youtube).toHaveClass(/on/, { timeout: 20_000 });
  await youtube.click();
  await expect(youtube).not.toHaveClass(/on/);

  // The content script reads this mirrored blob, not React state — so
  // this is the assertion that proves the toggle does anything at all.
  await expect
    .poll(
      async () =>
        worker.evaluate(async () => {
          const out = await chrome.storage.local.get('extensionPrefs');
          const prefs = out.extensionPrefs as
            | { platforms?: Record<string, { enabled?: boolean }> }
            | undefined;
          return prefs?.platforms?.youtube?.enabled;
        }),
      { timeout: 15_000 },
    )
    .toBe(false);

  // Turning the master off cascades to its surfaces, so the drawer can
  // never show "platform off with sub-toggles still ticked".
  const surfaces = await worker.evaluate(async () => {
    const out = await chrome.storage.local.get('extensionPrefs');
    const prefs = out.extensionPrefs as
      | { platforms?: Record<string, { surfaces?: Record<string, boolean> }> }
      | undefined;
    return prefs?.platforms?.youtube?.surfaces ?? {};
  });
  expect(Object.values(surfaces).every((value) => value === false)).toBe(true);

  await page.close();
});
