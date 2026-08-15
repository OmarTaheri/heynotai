// Apply the persisted theme class synchronously, before React mounts,
// so the first paint uses the correct background color. Loaded as an
// external script because MV3 CSP disallows inline scripts.
(function () {
  try {
    var raw = localStorage.getItem('heynotai-theme');
    var t = raw ? JSON.parse(raw) : 'system';
    var isDark = t === 'dark'
      || (t === 'system'
          && window.matchMedia
          && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('theme-dark', isDark);
    document.documentElement.classList.toggle('theme-light', !isDark);
  } catch (e) {}
})();
