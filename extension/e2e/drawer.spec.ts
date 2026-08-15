import { expect, seedPrefs, test } from './fixtures';
import { startTestServer, type TestServer } from './test-server';

/** Drawer lifecycle on a host page: does it open, does it close, does the
 *  control rail work, and does re-invoking the toolbar action toggle it.
 *
 *  `chrome.action.onClicked` cannot be dispatched from Playwright, so
 *  these drive the same code path the toolbar button does — the worker's
 *  drawer injection — by asking the worker to run it against the tab. */

let server: TestServer;

test.beforeAll(async () => {
  server = await startTestServer();
});

test.afterAll(async () => {
  await server.close();
});

const ROOT = '#heynotai-drawer-root';

test('the drawer opens on a page, and closes from the rail', async ({
  context,
  worker,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`${server.origin}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html[data-heynotai-extension]')).toHaveCount(1);

  // Open via the worker's OPEN_DRAWER path — the same message the
  // in-page sign-in CTA sends, and the same injection the toolbar
  // button performs. (`chrome.action.onClicked` cannot be dispatched
  // from Playwright, so we exercise the handler, not the click.)
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('no active tab');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => chrome.runtime.sendMessage({ type: 'OPEN_DRAWER' }),
    });
  });

  const root = page.locator(ROOT);
  await expect(root).toHaveCount(1, { timeout: 15_000 });

  // The drawer hosts the real UI in an iframe pointing at drawer.html.
  const frameSrc = await root.locator('iframe').getAttribute('src');
  expect(frameSrc).toContain(`chrome-extension://${extensionId}/drawer.html`);
  expect(frameSrc).toContain('tabId=');

  // Docked right by default, fully opaque once the slide-in settles.
  await expect(root).toHaveAttribute('data-side', 'right');

  // Close from the rail.
  await root.locator('button[data-action="close"]').click();
  await expect(root).toHaveCount(0, { timeout: 5_000 });

  await page.close();
});

test('the rail can re-dock the drawer to the other side', async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(`${server.origin}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html[data-heynotai-extension]')).toHaveCount(1);

  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab!.id! },
      func: () => chrome.runtime.sendMessage({ type: 'OPEN_DRAWER' }),
    });
  });

  const root = page.locator(ROOT);
  await expect(root).toHaveCount(1, { timeout: 15_000 });
  await expect(root).toHaveAttribute('data-side', 'right');

  await root.locator('button[data-action="dock"]').click();
  await expect(root).toHaveAttribute('data-side', 'left');

  await root.locator('button[data-action="dock"]').click();
  await expect(root).toHaveAttribute('data-side', 'right');

  await page.close();
});

test('pinning the drawer is remembered for the tab', async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(`${server.origin}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html[data-heynotai-extension]')).toHaveCount(1);

  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab!.id! },
      func: () => chrome.runtime.sendMessage({ type: 'OPEN_DRAWER' }),
    });
  });

  const root = page.locator(ROOT);
  await expect(root).toHaveCount(1, { timeout: 15_000 });

  await root.locator('button[data-action="pin"]').click();
  await expect(root).toHaveAttribute('data-pinned', '');

  // The pin state round-trips through the worker into storage, which is
  // what makes the drawer re-open on the next page load.
  await expect
    .poll(
      async () =>
        worker.evaluate(async () => {
          const out = await chrome.storage.local.get('pinnedTabs');
          const pinned = (out.pinnedTabs ?? {}) as Record<string, boolean>;
          return Object.values(pinned).some(Boolean);
        }),
      { timeout: 5_000 },
    )
    .toBe(true);

  await page.close();
});

test('a paused platform does not auto-scan', async ({ context, worker }) => {
  // Everything off: manual mode plus no allow-list entry. The content
  // script must not dispatch a scan for this page.
  await seedPrefs(worker, {
    scanMode: 'manual',
    platforms: {},
    sites: [],
    flags: {},
  });

  const page = await context.newPage();
  const scanRequests: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('PAGE_TEXT_SCAN_REQUEST')) {
      scanRequests.push(msg.text());
    }
  });
  await page.goto(`${server.origin}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html[data-heynotai-extension]')).toHaveCount(1);

  // The content script waits ~1s after load before its first runScan().
  await page.waitForTimeout(3_000);
  expect(scanRequests).toHaveLength(0);
  // And no overlay was drawn.
  await expect(page.locator('#heynotai-border')).toHaveCount(0);

  await page.close();
});
