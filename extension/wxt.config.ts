import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  manifest: {
    name: 'heynotai — AI Content Detector',
    description:
      'Real-time AI-generated media detection for YouTube. Spot deepfakes, cloned voices, and synthetic text at a glance.',
    version: '1.0.0',
    permissions: ['storage', 'activeTab', 'scripting', 'identity'],
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
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
});
