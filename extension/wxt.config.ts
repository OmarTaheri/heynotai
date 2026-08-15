import { defineConfig } from 'wxt';

// Pins the local extension ID across reloads and paths, so sign-in keeps
// working: the flow redirects to `https://<extension-id>.chromiumapp.org/
// website-auth`, and our own API rejects any ID missing from its
// EXTENSION_IDS allowlist. Nothing here is registered with Google — Google
// only ever sees the API's GOOGLE_REDIRECT_URI, never a chromiumapp.org URL.
//
// The matching private key (heynotai.pem) is gitignored and dev-only. The
// Chrome Web Store assigns its own ID at publish time and *rejects* any
// upload carrying a `key` field ("key field is not allowed in manifest"), so
// it is stripped from production builds; the store ID goes in EXTENSION_IDS
// alongside this one.
const DEV_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3s8DglU4jh4jDu5uNX2/PiLd79LgvEjBJtjeBRd8nOnR6hWDS891kpltl3qHFAFPcypKeViumpw/p+1bp2/zcZKK21BQ8mD7CF+UJHO15c+G+d0SL6BQx3XAEB7jj2T64LEKv08nRslEP2pP4NOzS91u9r4bpANbJ4s906G6tYB3P4L7TEr4mcHHReH5rD97qVLhcJbM/6TOTJ6ZO9Cgb2z1WlYYOKM9EIOnvlcYtm+SF9EZfBn0ADRD0vWOCegLiRujD+b1yD85pJON3Aqj7uJMKg69QYkHfOiMkB0m/cPE6YzCACO+nqh+Ii4H1C7Qs+YFsENAhXW8tQmsgccC9wIDAQAB';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  // `wxt` / `wxt build --mode development` (dev + e2e) keep the pinned key;
  // `wxt build` / `wxt zip` (mode: production) ship without it.
  manifest: ({ mode }) => ({
    name: 'heynotai - AI Content Detector',
    description:
      'Check text, images, and supported videos for signs of AI generation while you browse.',
    version: '1.0.1',
    ...(mode === 'development' ? { key: DEV_KEY } : {}),
    permissions: ['storage', 'activeTab', 'scripting', 'identity', 'contextMenus'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'heynotai',
    },
    // Real keyboard shortcuts, surfaced on the website's Extension page
    // and remappable by the user at chrome://extensions/shortcuts.
    // `_execute_action` is Chrome's reserved name for the toolbar button,
    // which is what toggles the drawer.
    commands: {
      _execute_action: {
        suggested_key: { default: 'Ctrl+Shift+D', mac: 'Command+Shift+D' },
        description: 'Open the heynotai drawer',
      },
      'scan-page': {
        suggested_key: { default: 'Ctrl+Shift+S', mac: 'Command+Shift+S' },
        description: 'Check the current page',
      },
    },
    web_accessible_resources: [
      {
        resources: ['drawer.html', 'assets/*', 'chunks/*', 'fonts/*'],
        matches: ['<all_urls>'],
      },
    ],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  }),
});
