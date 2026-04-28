import { useEffect, useState } from 'react';

export type Platform = 'facebook' | 'youtube' | 'instagram' | 'other';

export interface PlatformInfo {
  platform: Platform;
  url: string;
  host: string;
}

// Reads the current active tab and classifies its hostname.
// Works in the popup with the `activeTab` permission we already declare.
export async function detectPlatform(): Promise<PlatformInfo> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    if (!url) return { platform: 'other', url, host: '' };
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.endsWith('facebook.com'))  return { platform: 'facebook',  url, host };
    if (host.endsWith('youtube.com'))   return { platform: 'youtube',   url, host };
    if (host.endsWith('instagram.com')) return { platform: 'instagram', url, host };
    return { platform: 'other', url, host };
  } catch {
    return { platform: 'other', url: '', host: '' };
  }
}

export function usePlatform(): PlatformInfo {
  const [info, setInfo] = useState<PlatformInfo>({ platform: 'other', url: '', host: '' });
  useEffect(() => { detectPlatform().then(setInfo).catch(() => {}); }, []);
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
