import { useEffect, useMemo, useState } from 'react';

export type Platform = 'facebook' | 'youtube' | 'instagram' | 'other';
export type Surface = 'videos' | 'reels' | 'posts' | null;

export interface PlatformInfo {
  platform: Platform;
  surface: Surface;
  url: string;
  host: string;
  tabId: number | null;
}

function classifyHost(host: string): Platform {
  if (host.endsWith('facebook.com'))  return 'facebook';
  if (host.endsWith('youtube.com'))   return 'youtube';
  if (host.endsWith('instagram.com')) return 'instagram';
  return 'other';
}

function buildInfoFromUrl(url: string, tabId: number | null): PlatformInfo {
  if (!url) return { platform: 'other', surface: null, url: '', host: '', tabId };
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const platform = classifyHost(host);
    return { platform, surface: classifySurface(platform, url), url, host, tabId };
  } catch {
    return { platform: 'other', surface: null, url, host: '', tabId };
  }
}

export function classifySurface(platform: Platform, url: string): Surface {
  if (!url) return null;
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  if (platform === 'youtube') {
    if (path === '/watch' || path.startsWith('/watch')) return 'videos';
    if (path.startsWith('/shorts/')) return 'reels';
    return null;
  }
  if (platform === 'instagram') {
    if (path.startsWith('/reel/') || path.startsWith('/reels/')) return 'reels';
    if (path.startsWith('/p/')) return 'posts';
    return null;
  }
  if (platform === 'facebook') {
    if (path.startsWith('/reel/') || path.startsWith('/reels/')) return 'reels';
    if (
      /^\/[^/]+\/posts\//.test(path) ||
      path.startsWith('/permalink') ||
      path.startsWith('/photo') ||
      path.startsWith('/posts/')
    ) {
      return 'posts';
    }
    return null;
  }
  return null;
}

// Reads the current active tab and classifies its hostname.
// Works in the popup with the `activeTab` permission we already declare.
// Used as a fallback when the drawer iframe wasn't given tabId+url query
// params (e.g. an older injection still in flight after a code reload).
export async function detectPlatform(): Promise<PlatformInfo> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    const tabId = tab?.id ?? null;
    return buildInfoFromUrl(url, tabId);
  } catch {
    return { platform: 'other', surface: null, url: '', host: '', tabId: null };
  }
}

interface DrawerParams {
  tabId: number | null;
  url: string;
}

function readDrawerParams(): DrawerParams {
  try {
    const p = new URLSearchParams(window.location.search);
    const t = parseInt(p.get('tabId') || '', 10);
    return {
      tabId: Number.isNaN(t) ? null : t,
      url: p.get('url') || '',
    };
  } catch {
    return { tabId: null, url: '' };
  }
}

export function usePlatform(): PlatformInfo {
  const params = useMemo(readDrawerParams, []);

  // Bootstrap from iframe URL params if present so the drawer is correct
  // even when injected into a non-active tab.
  const [info, setInfo] = useState<PlatformInfo>(() =>
    params.url
      ? buildInfoFromUrl(params.url, params.tabId)
      : { platform: 'other', surface: null, url: '', host: '', tabId: params.tabId },
  );

  useEffect(() => {
    if (!params.url) {
      // Legacy iframe without query params — fall back to the active tab
      // (correct when the drawer was just user-clicked open).
      detectPlatform().then(setInfo).catch(() => {});
    }

    const onMessage = (
      msg: { type?: string; payload?: { platform: Platform; surface: Surface; url: string; host: string } },
      sender: chrome.runtime.MessageSender,
    ) => {
      if (msg?.type !== 'PAGE_CHANGED' || !msg.payload) return;
      // Only react to messages from our own host tab so multiple open
      // drawers across tabs don't cross-contaminate.
      if (params.tabId != null && sender.tab?.id !== params.tabId) return;
      const p = msg.payload;
      setInfo({
        platform: p.platform,
        surface: p.surface,
        url: p.url,
        host: p.host,
        tabId: params.tabId,
      });
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [params.tabId, params.url]);

  return info;
}

export function platformLabel(p: Platform): string {
  switch (p) {
    case 'facebook':  return 'Facebook mode';
    case 'youtube':   return 'YouTube mode';
    case 'instagram': return 'Instagram mode';
    default:          return 'This page';
  }
}
