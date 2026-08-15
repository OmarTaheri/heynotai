import {
  createContext, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import type { ScanEntry, Site } from './types';
import type { PageInfoPayload } from './messaging';
import {
  loadExtensionPrefs,
  saveExtensionPrefs,
  subscribeExtensionPrefs,
} from './extension-prefs-sync';
import { backend } from './backend';
import {
  DEFAULT_EXTENSION_PREFS,
  extensionFlag,
  migrateLegacyPlatforms,
  type ExtensionFlagId,
  type Platforms,
  type PlatformKey,
  type ScanMode,
  type SurfaceKey,
} from '@heynotai/shared';

export type Theme = 'light' | 'dark' | 'system';
export type Mode = 'normal' | 'power';
export type Language = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ar' | 'ja';
export type View = 'main' | 'account' | 'settings';
export type { PlatformKey, ScanMode, Platforms, SurfaceKey };

export interface NotificationPrefs {
  desktop: boolean;
  sound: boolean;
  threshold: number;
}

export interface PrivacyPrefs {
  cloud: boolean;
  cache: boolean;
  shareSignals: boolean;
}

interface AppState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  appliedTheme: 'light' | 'dark';

  scanning: boolean;
  progress: number;
  scanned: boolean;
  /** Last failure reason from the host scan (e.g. "youtube_too_long:4044s",
   *  "youtube_download_failed", "detection_failed"). Null when the last
   *  scan succeeded or there hasn't been one yet. The drawer uses this
   *  to surface a human-readable explanation in the idle state instead
   *  of silently dropping the user back to the "Check this page" UI. */
  scanError: string | null;
  startScan: () => void;
  resetScan: () => void;
  clearScanError: () => void;
  /** Latest PAGE_CHANGED payload from the host tab — `null` until the
   *  content script has reported in. The Content tab uses this to
   *  inject an optimistic "Scanning…" row for the current YouTube
   *  video before the backend's scan record reaches backend realtime. */
  currentPage: PageInfoPayload | null;
  lastScanResult: ScanEntry | null;

  scanMode: ScanMode;
  setScanMode: (m: ScanMode) => void;
  sites: Site[];
  setSites: (s: Site[]) => void;
  addSite: (host: string) => void;
  toggleSiteAt: (index: number) => void;
  removeSiteAt: (index: number) => void;
  setSiteEnabledByHost: (host: string, enabled: boolean) => void;
  /** Named behaviour toggles synced from the website's Extension page.
   *  Only the ids in `EXTENSION_FLAG_IDS` do anything. */
  flags: Record<string, boolean>;
  flag: (id: ExtensionFlagId) => boolean;
  platforms: Platforms;
  setPlatformEnabled: (k: PlatformKey, v: boolean) => void;
  setPlatformSurface: <P extends PlatformKey>(
    platform: P,
    surface: SurfaceKey<P>,
    enabled: boolean,
  ) => void;

  view: View;
  setView: (v: View) => void;
  toggleAccount: () => void;
  toggleSettings: () => void;

  mode: Mode;
  setMode: (m: Mode) => void;
  autoModelMode: boolean;
  setAutoModelMode: (v: boolean) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  notifications: NotificationPrefs;
  setNotifications: (p: NotificationPrefs) => void;
  privacy: PrivacyPrefs;
  setPrivacy: (p: PrivacyPrefs) => void;
}

const AppCtx = createContext<AppState | null>(null);

// ── localStorage helpers (offline cache) ────────────────────────
function load<T>(key: string, fallback: T, validate?: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    if (validate && !validate(v)) return fallback;
    return v as T;
  } catch { return fallback; }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function systemIsDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

function resolveTheme(t: Theme): 'light' | 'dark' {
  return t === 'system' ? (systemIsDark() ? 'dark' : 'light') : t;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    load<Theme>('heynotai-theme', 'system', (v) => v === 'light' || v === 'dark' || v === 'system'),
  );

  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<PageInfoPayload | null>(null);
  const [lastScanResult, setLastScanResult] = useState<ScanEntry | null>(null);

  const [view, setView] = useState<View>('main');

  const [mode, setModeState] = useState<Mode>(() =>
    load<Mode>('heynotai-mode', 'normal', (v) => v === 'normal' || v === 'power'),
  );
  const [autoModelMode, setAutoModelModeState] = useState<boolean>(() =>
    load<boolean>('heynotai-auto-model', false, (v) => typeof v === 'boolean'),
  );
  const [language, setLanguageState] = useState<Language>(() =>
    load<Language>('heynotai-language', 'en',
      (v) => ['en','es','fr','de','zh','ar','ja'].includes(v as string)),
  );
  const [notifications, setNotificationsState] = useState<NotificationPrefs>(() =>
    load<NotificationPrefs>('heynotai-notifications',
      { desktop: true, sound: false, threshold: 70 }),
  );
  const [privacy, setPrivacyState] = useState<PrivacyPrefs>(() =>
    load<PrivacyPrefs>('heynotai-privacy',
      { cloud: true, cache: true, shareSignals: false }),
  );

  const [scanMode, setScanModeState] = useState<ScanMode>(() =>
    load<ScanMode>('heynotai-scan-mode', 'allowlist',
      (v) => v === 'allowlist' || v === 'manual' || v === 'everything'),
  );
  // Starts empty. This used to be seeded with six invented hosts
  // (streamline.app, news.example, …) carrying invented scan counts,
  // which then synced to the user's account as if they had added them.
  const [sites, setSitesState] = useState<Site[]>(() =>
    load<Site[]>('heynotai-sites', [], (v) => Array.isArray(v)),
  );
  const [platforms, setPlatformsState] = useState<Platforms>(() =>
    migrateLegacyPlatforms(
      load<unknown>('heynotai-platforms', DEFAULT_EXTENSION_PREFS.platforms),
    ),
  );
  const [flags, setFlagsState] = useState<Record<string, boolean>>(() =>
    load<Record<string, boolean>>('heynotai-flags', {}, (v) =>
      !!v && typeof v === 'object' && !Array.isArray(v),
    ),
  );

  const [appliedTheme, setAppliedTheme] = useState<'light' | 'dark'>(() => resolveTheme(theme));
  const ignoreRealtimeRef = useRef(false);

  // Apply theme to body and react to system changes when Theme == 'system'
  useEffect(() => {
    const a = resolveTheme(theme);
    setAppliedTheme(a);
    document.body.classList.toggle('theme-dark', a === 'dark');
    document.body.classList.toggle('theme-light', a !== 'dark');
    save('heynotai-theme', theme);
    try { chrome.storage?.local.set({ appliedTheme: a }); } catch {}
    try { window.parent?.postMessage({ type: 'heynotai:theme', theme: a }, '*'); } catch {}

    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const na: 'light' | 'dark' = mq.matches ? 'dark' : 'light';
      setAppliedTheme(na);
      document.body.classList.toggle('theme-dark', na === 'dark');
      document.body.classList.toggle('theme-light', na !== 'dark');
      try { chrome.storage?.local.set({ appliedTheme: na }); } catch {}
      try { window.parent?.postMessage({ type: 'heynotai:theme', theme: na }, '*'); } catch {}
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  // Persist to localStorage (offline cache).
  useEffect(() => { save('heynotai-mode', mode); }, [mode]);
  useEffect(() => { save('heynotai-auto-model', autoModelMode); }, [autoModelMode]);
  useEffect(() => { save('heynotai-language', language); }, [language]);
  useEffect(() => { save('heynotai-notifications', notifications); }, [notifications]);
  useEffect(() => { save('heynotai-privacy', privacy); }, [privacy]);
  useEffect(() => { save('heynotai-scan-mode', scanMode); }, [scanMode]);
  useEffect(() => { save('heynotai-sites', sites); }, [sites]);
  useEffect(() => { save('heynotai-platforms', platforms); }, [platforms]);
  useEffect(() => { save('heynotai-flags', flags); }, [flags]);

  // Mirror gating prefs into chrome.storage.local so content scripts and
  // the service worker can read them without a backend round-trip, and
  // react to changes via chrome.storage.onChanged. `flags` rides along
  // because the overlay/context-menu/badge behaviours are gated on it.
  useEffect(() => {
    try {
      chrome.storage?.local.set({
        extensionPrefs: { platforms, scanMode, sites, flags },
      });
    } catch {}
  }, [platforms, scanMode, sites, flags]);

  // ── Mirror the host page's scan lifecycle into drawer UI ────────
  // The drawer's scanning/scanned UI used to be local-only; now the
  // content script drives it via SCAN_STARTED/SCAN_COMPLETE so the
  // drawer reflects right-click scans and resets when the user
  // navigates between videos/reels in the same tab.
  useEffect(() => {
    let myTabId: number | null = null;
    try {
      const p = new URLSearchParams(window.location.search);
      const t = parseInt(p.get('tabId') || '', 10);
      myTabId = Number.isNaN(t) ? null : t;
    } catch {}

    // Track the URL the drawer is currently mirroring. PAGE_CHANGED is
    // re-broadcast on the same video at t=0/1.5s/3.5s as YouTube hydrates
    // metadata (and once more at scan-start with full ytMeta). Treating
    // every broadcast as "navigation" wipes the scanning UI mid-scan and
    // makes the drawer look like the Check button did nothing — fixed
    // here by only resetting when the URL genuinely changed.
    let lastPageUrl: string | null = null;

    // Ask the content script (if any) what state the host page is in
    // right now. Handles "user right-clicked Check before opening
    // drawer" and "drawer auto-reopened on a tab that already scanned".
    if (myTabId != null) {
      try {
        void chrome.tabs
          ?.sendMessage(myTabId, { type: 'QUERY_STATE' })
          .then((response: unknown) => {
            if (!response || typeof response !== 'object') return;
            const r = response as {
              scanning?: boolean;
              scanned?: boolean;
              pageInfo?: PageInfoPayload;
            };
            // Seed lastPageUrl so the next same-page settle broadcast
            // doesn't wipe the scan state we're about to restore.
            if (r.pageInfo?.url) lastPageUrl = r.pageInfo.url;
            if (r.pageInfo) setCurrentPage(r.pageInfo);
            if (r.scanning) {
              setProgress(0);
              setScanned(false);
              setScanning(true);
            } else if (r.scanned) {
              setProgress(100);
              setScanning(false);
              setScanned(true);
            }
          })
          .catch(() => {
            // Content script not present (e.g. tab is on a non-supported
            // host like nytimes.com). Drawer stays in idle state.
          });
      } catch {}
    }

    const onMessage = (msg: unknown, sender: chrome.runtime.MessageSender) => {
      const m = msg as {
        type?: string;
        payload?: PageInfoPayload;
        result?: ScanEntry;
        error?: string;
      } | null;
      if (!m?.type) return;
      // Only filter content-script messages by tabId. SW broadcasts
      // (no sender.tab) — like the SCAN_FAILED dispatched after a
      // re-inject failure — apply globally and must not be dropped.
      if (sender.tab && myTabId != null && sender.tab.id !== myTabId) return;

      if (m.type === 'SCAN_STARTED') {
        console.info('[heynotai/drawer] SCAN_STARTED received', {
          tabId: sender.tab?.id,
        });
        setProgress(0);
        setScanned(false);
        setLastScanResult(null);
        setScanError(null);
        setScanning(true);
      } else if (m.type === 'SCAN_COMPLETE') {
        console.info('[heynotai/drawer] SCAN_COMPLETE received');
        setProgress(100);
        setScanning(false);
        setScanError(null);
        setScanned(true);
        const result = (msg as { payload?: ScanEntry }).payload;
        if (result) setLastScanResult(result);
      } else if (m.type === 'SCAN_FAILED') {
        console.info('[heynotai/drawer] SCAN_FAILED received', { error: m.error });
        setScanning(false);
        setScanned(false);
        setLastScanResult(null);
        setProgress(0);
        setScanError(m.error ?? 'unknown_error');
      } else if (m.type === 'PAGE_CHANGED') {
        const nextUrl = m.payload?.url ?? null;
        // Always mirror the latest page info — even on a settle
        // re-broadcast, where the URL is the same but the youtube
        // payload may now have hydrated title/channel that the
        // optimistic Content row needs.
        if (m.payload) setCurrentPage(m.payload);
        if (lastPageUrl !== null && nextUrl === lastPageUrl) {
          // Same page, just a metadata-settle re-broadcast — leave the
          // scan lifecycle alone.
          return;
        }
        lastPageUrl = nextUrl;
        // Different video/reel/post — wipe any prior verdict state so
        // the drawer doesn't show last page's result for this one.
        setScanning(false);
        setScanned(false);
        setLastScanResult(null);
        setProgress(0);
        setScanError(null);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  // ── backend sync: hydrate from server on auth, push changes back ────
  // Hydrate on mount + whenever auth state changes.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const remote = await loadExtensionPrefs();
      if (!remote || cancelled) return;
      ignoreRealtimeRef.current = true;
      const migratedPlatforms = migrateLegacyPlatforms(remote.platforms);
      setModeState(remote.mode);
      setAutoModelModeState(remote.autoModelMode);
      setScanModeState(remote.scanMode);
      setSitesState(remote.sites as Site[]);
      setPlatformsState(migratedPlatforms);
      setNotificationsState(remote.notifications);
      setPrivacyState(remote.privacy);
      setFlagsState(remote.flags ?? {});
      setTimeout(() => {
        ignoreRealtimeRef.current = false;
      }, 50);
      // Heal: if the remote row stored the legacy flat shape, persist
      // the canonical nested shape back so we stop migrating on every
      // hydrate.
      const wasLegacy =
        remote.platforms &&
        typeof remote.platforms === 'object' &&
        Object.values(remote.platforms as Record<string, unknown>).some(
          (v) => typeof v === 'boolean',
        );
      if (wasLegacy && backend.authStore.isValid) {
        void saveExtensionPrefs({ platforms: migratedPlatforms });
      }
    };
    void hydrate();

    let unsubRealtime: (() => void) | null = null;
    const subscribe = async () => {
      unsubRealtime?.();
      unsubRealtime = null;
      if (!backend.authStore.isValid) return;
      const next = await subscribeExtensionPrefs((remote) => {
        if (cancelled) return;
        ignoreRealtimeRef.current = true;
        setModeState(remote.mode);
        setAutoModelModeState(remote.autoModelMode);
        setScanModeState(remote.scanMode);
        setSitesState(remote.sites as Site[]);
        setPlatformsState(migrateLegacyPlatforms(remote.platforms));
        setNotificationsState(remote.notifications);
        setPrivacyState(remote.privacy);
        setFlagsState(remote.flags ?? {});
        window.setTimeout(() => {
          ignoreRealtimeRef.current = false;
        }, 500);
      });
      if (cancelled) next();
      else unsubRealtime = next;
    };
    void subscribe();

    const unsubAuth = backend.authStore.onChange(() => {
      void hydrate();
      void subscribe();
    });

    return () => {
      cancelled = true;
      unsubAuth();
      unsubRealtime?.();
    };
  }, []);

  // Push every change to backend (debounced and only when authed).
  const debounceRef = useRef<number | null>(null);

  const sitesJson = JSON.stringify(sites);
  const platformsJson = JSON.stringify(platforms);
  const notificationsJson = JSON.stringify(notifications);
  const privacyJson = JSON.stringify(privacy);
  const flagsJson = JSON.stringify(flags);

  useEffect(() => {
    if (!backend.authStore.isValid) return;
    if (ignoreRealtimeRef.current) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void saveExtensionPrefs({
        mode,
        autoModelMode,
        scanMode,
        sites: JSON.parse(sitesJson),
        platforms: JSON.parse(platformsJson),
        notifications: JSON.parse(notificationsJson),
        privacy: JSON.parse(privacyJson),
        flags: JSON.parse(flagsJson),
      });
    }, 400);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [mode, autoModelMode, scanMode, sitesJson, platformsJson, notificationsJson, privacyJson, flagsJson]);

  // No simulated progress sweep — the drawer ring is now driven by
  // SCAN_STARTED/SCAN_COMPLETE messages from the content script (which
  // in turn reflect real backend status). `progress` toggles between 0
  // and 100 at the lifecycle bookends; the visual is an indeterminate
  // spinner regardless. The 0→100 sweep was lying to users when real
  // YouTube scans took 30-90s.

  // Note: previously had a "self-heal" effect that reset scanning when
  // the active platform was disabled in prefs. That fought against
  // legitimate manual scans (the user can click "Check this page" on a
  // disabled platform — that scan should still show its loading UI).
  // The content script is the single source of truth for scan
  // lifecycle now: it sends SCAN_FAILED if a pref change cancels an
  // in-flight scan.

  /** Reads a behaviour flag with its documented default applied, so
   *  "never set" and "explicitly on" behave identically. */
  function flag(id: ExtensionFlagId): boolean {
    return extensionFlag(flags, id);
  }

  function setTheme(t: Theme) { setThemeState(t); }
  function setMode(m: Mode) { setModeState(m); }
  function setAutoModelMode(v: boolean) { setAutoModelModeState(v); }
  function setLanguage(l: Language) { setLanguageState(l); }
  function setNotifications(p: NotificationPrefs) { setNotificationsState(p); }
  function setPrivacy(p: PrivacyPrefs) { setPrivacyState(p); }

  function startScan() {
    if (scanning) return;
    setProgress(0);
    setScanned(false);
    setScanError(null);
    setScanning(true);
  }

  function resetScan() {
    setScanning(false);
    setProgress(0);
    setScanned(false);
    setScanError(null);
  }

  function clearScanError() {
    setScanError(null);
  }

  function setScanMode(m: ScanMode) { setScanModeState(m); }
  function setSites(s: Site[]) { setSitesState(s); }
  function addSite(host: string) {
    setSitesState(prev => {
      const clean = host.replace(/^www\./, '');
      if (prev.some(s => s.host === clean)) {
        return prev.map(s => s.host === clean ? { ...s, enabled: true } : s);
      }
      return [{ host: clean, enabled: true }, ...prev];
    });
  }
  function toggleSiteAt(index: number) {
    setSitesState(prev => prev.map((x, i) => i === index ? { ...x, enabled: !x.enabled } : x));
  }
  function removeSiteAt(index: number) {
    setSitesState(prev => prev.filter((_, i) => i !== index));
  }
  function setSiteEnabledByHost(host: string, enabled: boolean) {
    const clean = host.replace(/^www\./, '');
    setSitesState(prev => prev.map(s => s.host === clean ? { ...s, enabled } : s));
  }
  function setPlatformEnabled(k: PlatformKey, v: boolean) {
    setPlatformsState(prev => {
      const cfg = prev[k];
      // Cascade master → surfaces. Toggling YouTube off should also
      // turn off Videos+Reels (and vice versa), so the UI never shows
      // "platform on with nothing enabled" or "off with sub-toggles
      // still ticked".
      const surfaceKeys = Object.keys(cfg.surfaces);
      const newSurfaces = surfaceKeys.reduce<Record<string, boolean>>(
        (acc, key) => { acc[key] = v; return acc; },
        {},
      );
      return {
        ...prev,
        [k]: { ...cfg, enabled: v, surfaces: newSurfaces },
      } as Platforms;
    });
  }
  function setPlatformSurface<P extends PlatformKey>(
    platform: P,
    surface: SurfaceKey<P>,
    enabled: boolean,
  ) {
    setPlatformsState(prev => {
      const cfg = prev[platform];
      const newSurfaces = { ...cfg.surfaces, [surface]: enabled };
      // Auto-derive master from surfaces: on when any surface is on,
      // off when all are off. Pairs with the master→surface cascade
      // above to keep the two consistent.
      const anyOn = Object.values(newSurfaces).some(Boolean);
      return {
        ...prev,
        [platform]: { ...cfg, enabled: anyOn, surfaces: newSurfaces },
      } as Platforms;
    });
  }

  function toggleAccount() { setView(v => v === 'account' ? 'main' : 'account'); }
  function toggleSettings() { setView(v => v === 'settings' ? 'main' : 'settings'); }

  return (
    <AppCtx.Provider value={{
      theme, setTheme, appliedTheme,
      scanning, progress, scanned, scanError,
      startScan, resetScan, clearScanError, currentPage, lastScanResult,
      scanMode, setScanMode,
      sites, setSites, addSite, toggleSiteAt, removeSiteAt, setSiteEnabledByHost,
      platforms, setPlatformEnabled, setPlatformSurface,
      flags, flag,
      view, setView, toggleAccount, toggleSettings,
      mode, setMode,
      autoModelMode, setAutoModelMode,
      language, setLanguage,
      notifications, setNotifications,
      privacy, setPrivacy,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
