import { hostMatches, type PageInfo } from './page-classify';

/** Auto-scan policy, extracted from the content script so every branch
 *  can be tested directly.
 *
 *  The decision carries the gate that produced it. Silently dropping (or
 *  silently firing) scans made "why is this video scanning when I
 *  disabled YouTube?" impossible to answer.
 */
export interface ScanPrefs {
  platforms?: Record<
    string,
    { enabled?: boolean; surfaces?: Record<string, boolean> }
  >;
  scanMode?: 'allowlist' | 'manual' | 'everything';
  sites?: Array<{ host?: string; enabled?: boolean }>;
}

export type ScanDecision = { allow: boolean; reason: ScanReason };

export type ScanReason =
  | 'prefs_not_loaded'
  | 'scan_mode_manual'
  | 'mode_everything'
  | 'site_allowlist_match'
  | 'site_disabled'
  | 'site_not_allowlisted'
  | 'platform_unknown'
  | 'platform_disabled'
  | 'surface_disabled'
  | 'allowlist_match';

export function shouldAutoScan(
  info: PageInfo,
  prefs: ScanPrefs | null,
  host: string,
): ScanDecision {
  // Default-OFF when prefs haven't loaded. This previously defaulted ON
  // to keep first-install scans working, but that race-bypassed every
  // user-set "platform off" toggle until the drawer next ran.
  if (!prefs) return { allow: false, reason: 'prefs_not_loaded' };
  if (prefs.scanMode === 'manual') {
    return { allow: false, reason: 'scan_mode_manual' };
  }

  if (info.platform === 'other') {
    if (prefs.scanMode === 'everything') {
      return { allow: true, reason: 'mode_everything' };
    }
    const site = prefs.sites?.find(
      (candidate) => !!candidate.host && hostMatches(candidate.host, host),
    );
    if (site?.enabled === true) {
      return { allow: true, reason: 'site_allowlist_match' };
    }
    return {
      allow: false,
      reason: site ? 'site_disabled' : 'site_not_allowlisted',
    };
  }

  // Platform-level off-switch wins in every mode, including
  // `everything` — otherwise the per-platform toggle would be
  // meaningless for a user who is in everything-mode but has
  // explicitly disabled, say, YouTube.
  const platform = prefs.platforms?.[info.platform];
  if (!platform) return { allow: false, reason: 'platform_unknown' };
  if (platform.enabled !== true) {
    return { allow: false, reason: 'platform_disabled' };
  }
  if (prefs.scanMode === 'everything') {
    return { allow: true, reason: 'mode_everything' };
  }
  // allowlist mode → the surface toggle gates the auto-scan.
  if (!info.surface || platform.surfaces?.[info.surface] !== true) {
    return { allow: false, reason: 'surface_disabled' };
  }
  return { allow: true, reason: 'allowlist_match' };
}
