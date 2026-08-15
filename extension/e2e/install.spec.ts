import { expect, readStorage, seedPrefs, test } from './fixtures';
import { startTestServer } from './test-server';

/** The extension is loaded and wired up: worker registers, manifest
 *  declares what the website and the shortcuts UI promise, and the
 *  content script attaches to an ordinary page. */

test('the background service worker registers', async ({ worker }) => {
  expect(worker.url()).toContain('background');
  const version = await worker.evaluate(
    () => chrome.runtime.getManifest().version,
  );
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
});

test('the manifest declares the keyboard shortcuts the website advertises', async ({
  worker,
}) => {
  const commands = await worker.evaluate(
    () => chrome.runtime.getManifest().commands ?? {},
  );
  // /app/extension lists exactly these two; a shortcut shown there but
  // missing here would be a promise the browser can't keep.
  expect(Object.keys(commands).sort()).toEqual(['_execute_action', 'scan-page']);
});

test('the manifest requests only the permissions the code uses', async ({
  worker,
}) => {
  const permissions = await worker.evaluate(
    () => chrome.runtime.getManifest().permissions ?? [],
  );
  expect(permissions.sort()).toEqual(
    ['activeTab', 'contextMenus', 'identity', 'scripting', 'storage'].sort(),
  );
});

test('the content script stamps the install marker the website reads', async ({
  context,
}) => {
  // A real http:// origin — content scripts do not run on about:blank
  // or data: documents, so page.setContent() would prove nothing.
  const server = await startTestServer();
  const page = await context.newPage();
  await page.goto(`${server.origin}/`, { waitUntil: 'domcontentloaded' });

  // `useExtensionPresence` on /app/extension watches for this attribute
  // to decide "installed" vs "not detected".
  const marker = page.locator('html[data-heynotai-extension]');
  await expect(marker).toHaveCount(1, { timeout: 15_000 });

  const version = await page.evaluate(() =>
    document.documentElement.getAttribute('data-heynotai-extension'),
  );
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);

  const id = await page.evaluate(() =>
    document.documentElement.getAttribute('data-heynotai-extension-id'),
  );
  expect(id).toBeTruthy();

  await page.close();
  await server.close();
});

test('preferences written by the drawer are visible to the worker', async ({
  worker,
}) => {
  await seedPrefs(worker, {
    scanMode: 'manual',
    platforms: { youtube: { enabled: false, surfaces: { videos: false } } },
    sites: [],
    flags: { 'right-click': false },
  });

  const stored = (await readStorage(worker, 'extensionPrefs')) as {
    scanMode?: string;
    flags?: Record<string, boolean>;
  };
  expect(stored.scanMode).toBe('manual');
  expect(stored.flags?.['right-click']).toBe(false);
});
