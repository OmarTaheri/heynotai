import {
  createContext, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import type { Site } from './types';
import { SITES as DEFAULT_SITES } from './sample-data';
import {
  loadExtensionPrefs,
  saveExtensionPrefs,
  subscribeExtensionPrefs,
} from './extension-prefs-sync';
import { pb } from './pocketbase';

export type Theme = 'light' | 'dark' | 'system';
export type Mode = 'normal' | 'power';
export type Language = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ar' | 'ja';
export type View = 'main' | 'account' | 'settings';
export type ScanMode = 'allowlist' | 'manual' | 'everything';
export type PlatformKey = 'facebook' | 'youtube' | 'instagram';

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
  startScan: () => void;
  resetScan: () => void;

  scanMode: ScanMode;
  setScanMode: (m: ScanMode) => void;
  sites: Site[];
  setSites: (s: Site[]) => void;
  addSite: (host: string) => void;
  toggleSiteAt: (index: number) => void;
  removeSiteAt: (index: number) => void;
  setSiteEnabledByHost: (host: string, enabled: boolean) => void;
  platforms: Record<PlatformKey, boolean>;
  setPlatformEnabled: (k: PlatformKey, v: boolean) => void;

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
  const intervalRef = useRef<number | null>(null);

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
  const [sites, setSitesState] = useState<Site[]>(() =>
    load<Site[]>('heynotai-sites', DEFAULT_SITES, (v) => Array.isArray(v)),
  );
  const [platforms, setPlatformsState] = useState<Record<PlatformKey, boolean>>(() =>
    load<Record<PlatformKey, boolean>>('heynotai-platforms',
      { facebook: true, youtube: true, instagram: true }),
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

  // ── PB sync: hydrate from server on auth, push changes back ────
  // Hydrate on mount + whenever auth state changes.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const remote = await loadExtensionPrefs();
      if (!remote || cancelled) return;
      ignoreRealtimeRef.current = true;
      setModeState(remote.mode);
      setAutoModelModeState(remote.autoModelMode);
      setScanModeState(remote.scanMode);
      setSitesState(remote.sites as Site[]);
      setPlatformsState(remote.platforms as Record<PlatformKey, boolean>);
      setNotificationsState(remote.notifications);
      setPrivacyState(remote.privacy);
      setTimeout(() => {
        ignoreRealtimeRef.current = false;
      }, 50);
    };
    void hydrate();

    const unsubAuth = pb.authStore.onChange(() => {
      void hydrate();
    });

    let unsubRealtime: (() => void) | null = null;
    void subscribeExtensionPrefs((remote) => {
      if (cancelled || ignoreRealtimeRef.current) return;
      setModeState(remote.mode);
      setAutoModelModeState(remote.autoModelMode);
      setScanModeState(remote.scanMode);
      setSitesState(remote.sites as Site[]);
      setPlatformsState(remote.platforms as Record<PlatformKey, boolean>);
      setNotificationsState(remote.notifications);
      setPrivacyState(remote.privacy);
    }).then((u) => {
      unsubRealtime = u;
    });

    return () => {
      cancelled = true;
      unsubAuth();
      unsubRealtime?.();
    };
  }, []);

  // Push every change to PB (debounced and only when authed).
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!pb.authStore.isValid) return;
    if (ignoreRealtimeRef.current) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void saveExtensionPrefs({
        mode,
        autoModelMode,
        scanMode,
        sites: sites,
        platforms,
        notifications,
        privacy,
      });
    }, 400);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [mode, autoModelMode, scanMode, sites, platforms, notifications, privacy]);

  // Scan progress simulation
  useEffect(() => {
    if (!scanning) return;
    let p = 0;
    const id = window.setInterval(() => {
      p += 3 + Math.random() * 4;
      if (p >= 100) {
        p = 100;
        setProgress(p);
        setScanning(false);
        setScanned(true);
        return;
      }
      setProgress(p);
    }, 120);
    intervalRef.current = id;
    return () => { window.clearInterval(id); intervalRef.current = null; };
  }, [scanning]);

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
    setScanning(true);
  }

  function resetScan() {
    setScanning(false);
    setProgress(0);
    setScanned(false);
  }

  function setScanMode(m: ScanMode) { setScanModeState(m); }
  function setSites(s: Site[]) { setSitesState(s); }
  function addSite(host: string) {
    setSitesState(prev => {
      const clean = host.replace(/^www\./, '');
      if (prev.some(s => s.host === clean)) {
        return prev.map(s => s.host === clean ? { ...s, enabled: true } : s);
      }
      return [{ host: clean, enabled: true, count: 0, ai: 0 }, ...prev];
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
    setPlatformsState(prev => ({ ...prev, [k]: v }));
  }

  function toggleAccount() { setView(v => v === 'account' ? 'main' : 'account'); }
  function toggleSettings() { setView(v => v === 'settings' ? 'main' : 'settings'); }

  return (
    <AppCtx.Provider value={{
      theme, setTheme, appliedTheme,
      scanning, progress, scanned, startScan, resetScan,
      scanMode, setScanMode,
      sites, setSites, addSite, toggleSiteAt, removeSiteAt, setSiteEnabledByHost,
      platforms, setPlatformEnabled,
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
