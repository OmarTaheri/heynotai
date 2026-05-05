import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  manifest: {
    name: 'heynotai — AI Content Detector',
    description:
      'Real-time AI-generated media detection for YouTube. Spot deepfakes, cloned voices, and synthetic text at a glance.',
    version: '1.0.0',
    // Pins the local extension ID across reloads/paths so OAuth redirect
    // URLs registered in Google Cloud Console keep working. The matching
    // private key (heynotai.pem) is gitignored — only used for dev. The
    // Chrome Web Store assigns its own ID at publish time and ignores
    // this field, so production gets a separate redirect URL registered
    // alongside this one.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3s8DglU4jh4jDu5uNX2/PiLd79LgvEjBJtjeBRd8nOnR6hWDS891kpltl3qHFAFPcypKeViumpw/p+1bp2/zcZKK21BQ8mD7CF+UJHO15c+G+d0SL6BQx3XAEB7jj2T64LEKv08nRslEP2pP4NOzS91u9r4bpANbJ4s906G6tYB3P4L7TEr4mcHHReH5rD97qVLhcJbM/6TOTJ6ZO9Cgb2z1WlYYOKM9EIOnvlcYtm+SF9EZfBn0ADRD0vWOCegLiRujD+b1yD85pJON3Aqj7uJMKg69QYkHfOiMkB0m/cPE6YzCACO+nqh+Ii4H1C7Qs+YFsENAhXW8tQmsgccC9wIDAQAB',
    permissions: ['storage', 'activeTab', 'scripting', 'identity', 'contextMenus'],
    host_permissions: ['<all_urls>'],
    oauth2: {
      client_id: '__set_in_pocketbase_admin__',
      scopes: ['email', 'profile'],
    },
    action: {
      default_title: 'heynotai',
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
  },
});
