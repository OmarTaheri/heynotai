import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { RingScore } from '@/components/RingScore';
import { Row } from '@/components/Row';
import { MiniSpark } from '@/components/MiniSpark';
import { BREAKDOWN, WATCHING } from '@/lib/sample-data';
import { usePlatform, platformLabel } from '@/lib/platform';
import { useApp, type PlatformKey, type SurfaceKey } from '@/lib/state';
import type { Verdict } from '@/lib/types';
import {
  colorVarOf,
  contentFor,
  contentNoun,
  hostMatches,
  platformIcon,
  verdictFromScan,
  verdictOf,
} from './helpers';
import { useLatestTextScan } from './use-latest-text-scan';
import { useExistingScan } from './use-existing-scan';
import { TextScanResultView } from './text-scan-result';
import { CreatorCard } from './creator-card';
import { ScanFailedCard } from './scan-failed-card';

/** Build the canonical URL the SW uses for de-dup so the hook's PB
 *  lookup matches scans created by the extension/site flows. Returns
 *  null when we don't know the media id yet — the hook just won't
 *  query in that case. */
function canonicalSourceUrl(
  platform: string,
  surface: string | null,
  rawUrl: string,
  videoId?: string,
): string | null {
  if (platform !== 'youtube') return null;
  let id = videoId ?? '';
  if (!id) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.pathname === '/watch' || parsed.pathname.startsWith('/watch')) {
        id = parsed.searchParams.get('v') ?? '';
      } else if (parsed.pathname.startsWith('/shorts/')) {
        id = parsed.pathname.split('/shorts/')[1]?.split('/')[0] ?? '';
      }
    } catch {
      /* malformed URL — bail */
    }
  }
  if (!id) return null;
  return surface === 'reels'
    ? `https://www.youtube.com/shorts/${id}`
    : `https://www.youtube.com/watch?v=${id}`;
}

export function Home() {
  const { platform, surface, host, tabId, youtube, url } = usePlatform();
  const {
    scanning, progress, scanned, scanError,
    startScan, clearScanError,
    scanMode, setScanMode, sites, platforms, addSite,
    setPlatformEnabled, setPlatformSurface, setSiteEnabledByHost,
  } = useApp();

  const isSocial = platform !== 'other';

  const latestTextScan = useLatestTextScan();
  const cachedSourceUrl = useMemo(
    () => canonicalSourceUrl(platform, surface, url, youtube?.videoId),
    [platform, surface, url, youtube?.videoId],
  );
  const existingScan = useExistingScan(cachedSourceUrl);
  const [dismissedScanId, setDismissedScanId] = useState<string | null>(null);
  // Right-click text-scan results only make sense on non-social pages
  // (articles, blogs). On YT/IG/FB pages we have a dedicated scan flow
  // and surfacing a stale text scan there is confusing — it makes the
  // user think it's the result of the video they were just watching.
  const showTextResult =
    !!latestTextScan
    && latestTextScan.id !== dismissedScanId
    && !isSocial;
  const dismissTextResult = () => {
    if (latestTextScan) setDismissedScanId(latestTextScan.id);
  };
  const platformEnabled = isSocial ? platforms[platform]?.enabled === true : false;
  const platformPaused = isSocial && !platformEnabled;
  const surfaceEnabled =
    isSocial && surface
      ? (platforms[platform]?.surfaces as Record<string, boolean> | undefined)?.[surface] === true
      : true;
  const surfaceOff =
    isSocial && platformEnabled && !!surface && !surfaceEnabled;

  const siteMatch = useMemo(
    () => host ? sites.find(s => hostMatches(s.host, host)) : undefined,
    [host, sites],
  );
  const whitelistedSite = !!siteMatch && siteMatch.enabled;
  const pausedSite = !!siteMatch && !siteMatch.enabled;

  const surfaceCovered =
    isSocial && platformEnabled && !!surface && surfaceEnabled;
  const covered = surfaceCovered || whitelistedSite;
  const isPaused = platformPaused || pausedSite;
  const manualMode = scanMode === 'manual';

  // Auto-scan policy. Platform-level "off" wins in every mode — even
  // `everything` mode shouldn't override an explicit per-platform
  // pause, otherwise the toggle would be cosmetic. For non-social
  // sites in `everything` mode we still scan (no platform toggle to
  // honour); allowlist mode falls back to the per-site whitelist.
  const autoScan = (() => {
    if (manualMode) return false;
    if (isSocial && !platformEnabled) return false;
    if (isSocial && !surfaceEnabled && scanMode !== 'everything') return false;
    if (scanMode === 'everything') return true;
    return covered;
  })();

  // Send the page-level scan trigger via the SW so the SW can re-inject
  // content.js if it isn't loaded (extension was reloaded after the
  // page was opened, edge SPA navigation, etc.). Direct chrome.tabs
  // .sendMessage from the drawer iframe fails with "Receiving end does
  // not exist" in those cases and the drawer used to spin forever.
  const triggerPageScan = () => {
    console.info('[heynotai/drawer] triggerPageScan', {
      tabId, platform, surface, host,
    });
    startScan();
    if (tabId == null) {
      console.warn('[heynotai/drawer] no tabId — cannot dispatch scan');
      return;
    }
    // Fire-and-forget. The SW broadcasts back via SCAN_STARTED (success
    // path: content script committed) or SCAN_FAILED (couldn't deliver
    // even after re-inject), both of which state.tsx already handles.
    try {
      void chrome.runtime
        .sendMessage({ type: 'TRIGGER_MANUAL_SCAN', tabId })
        .then(() => console.info('[heynotai/drawer] TRIGGER_MANUAL_SCAN dispatched'))
        .catch((err) =>
          console.warn('[heynotai/drawer] TRIGGER_MANUAL_SCAN dispatch failed', err),
        );
    } catch (err) {
      console.warn('[heynotai/drawer] runtime.sendMessage threw', err);
    }
  };

  // Kick off an auto-scan when the popup opens on an already-covered site.
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (!host && !isSocial) return;
    console.info('[heynotai/drawer] auto-scan gate', {
      host,
      platform,
      surface,
      scanMode,
      platformEnabled,
      surfaceEnabled,
      whitelistedSite,
      autoScan,
      scanning,
      scanned,
      isPaused,
    });
    if (autoScan && !scanning && !scanned) {
      autoFiredRef.current = true;
      console.info('[heynotai/drawer] auto-scan firing');
      startScan();
    }
  }, [
    autoScan, scanning, scanned, startScan, host, isSocial,
    platform, surface, scanMode, platformEnabled, surfaceEnabled,
    whitelistedSite, isPaused,
  ]);

  const content = contentFor(platform, youtube);
  // Cached verdict overrides the sample-data score/verdict so the
  // result panel reflects the user's actual prior scan instead of the
  // mock numbers. Dismissed scans fall through to the idle UI so the
  // user can re-run a check if they want.
  const useExistingResult =
    !!existingScan && existingScan.id !== dismissedScanId;
  const pageScore = useExistingResult
    ? Math.max(0, Math.min(100, Math.round(existingScan!.aiPct)))
    : (content?.score ?? 62);
  const pageVerdict: Verdict = useExistingResult
    ? verdictFromScan(existingScan!)
    : (content?.verdict ?? 'ai');

  const hostLabel = host || (isSocial ? platformLabel(platform) : 'unknown');
  const displayed = Math.round(scanning ? (pageScore * progress) / 100 : pageScore);

  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {isSocial && <Icon name={platformIcon(platform)} size={14} />}
      {platformLabel(platform)}
    </span>
  );

  // ── State 1: scanning — skeleton mirror of the result layout ─
  if (scanning) {
    const CIRC = 2 * Math.PI * 35;
    const ARC = CIRC * 0.28;
    return (
      <div className="panel is-skeleton">
        <MetricCard
          title={title}
          action={<span className="card-action-mono">{hostLabel}</span>}
        >
          <div className={`page-summary verdict-${pageVerdict} scanning-summary`}>
            <div className="ring scan-ring" aria-hidden>
              <div className="scan-ring-glow" />
              <svg className="scan-ring-base" width={80} height={80}>
                <circle cx={40} cy={40} r={35} fill="none"
                  stroke="var(--line-strong)" strokeWidth={5} strokeDasharray="3 3" />
              </svg>
              {/* Indeterminate arc — already animated via the existing
                  `ring-spin` keyframe on .scan-ring-arc. Honest about
                  not knowing how long the scan will take, instead of
                  the previous 0→100% sweep that finished in 3s every
                  time regardless of the actual scan duration. */}
              <svg className="scan-ring-arc" width={80} height={80}>
                <circle cx={40} cy={40} r={35} fill="none"
                  stroke={colorVarOf(pageVerdict)} strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={`${ARC} ${CIRC - ARC}`} />
              </svg>
              <div className="ring-label mono">
                <span className="scan-ring-dots" aria-hidden>
                  <span></span><span></span><span></span>
                </span>
              </div>
            </div>
            <div className="summary-copy">
              <div className="label">
                Analyzing {contentNoun(platform)}… <Icon name="info" size={12} />
              </div>
              <div className="score scan-score">
                <span className={`verdict-tag ${pageVerdict} pulse-tag`}>analyzing</span>
              </div>
              <div className="sub">
                {content ? content.tagline.replace(/\.$/, '') + '…' : 'Inspecting content on this page…'}
              </div>
            </div>
          </div>
          {content && content.title && content.title !== '—' && (
            <div className="page-title-line" title={content.title}>
              {content.title}
            </div>
          )}
          <div>
            {(content ? content.signals : [
              { label: 'Scanned items' },
              { label: 'Flagged items' },
              { label: 'Confidence avg' },
              { label: 'Scan time' },
            ]).map((s, i) => (
              <div key={i} className="row">
                <span className="row-label">{s.label}</span>
                <span className="skeleton-block s-val" />
              </div>
            ))}
          </div>
        </MetricCard>

        {content ? (
          // Render the real end-state CreatorCard during scanning too.
          // The historical-stat rows ("Content scanned", "Flagged
          // history", "Avg AI-likelihood", "Last checked") only render
          // for sample-data platforms (FB/IG) — YouTube returns
          // `scanned = 0` from `youtubeContentFromMeta`, so the same
          // component naturally hides the rows that don't exist in the
          // end state. No skeleton blocks for fields the result
          // wouldn't show anyway.
          <CreatorCard content={content} platform={platform} />
        ) : (
          <>
            <MetricCard
              title="By content type"
              action={<span className="skeleton-block s-chip" />}
            >
              <div>
                {BREAKDOWN.map(b => (
                  <div key={b.kind} className="breakdown-row">
                    <div className="br-icon"><Icon name={b.kind} size={14} /></div>
                    <div className="br-body">
                      <div className="br-head">
                        <span className="br-name">{b.label}</span>
                        <span className="skeleton-block s-count" />
                      </div>
                      <div className="br-track">
                        <div className="br-fill skeleton-bar" />
                      </div>
                    </div>
                    <span className="skeleton-block s-spark" />
                  </div>
                ))}
              </div>
            </MetricCard>

            <MetricCard
              title="Watching"
              action={<span className="skeleton-block s-chip" />}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {WATCHING.map(s => (
                  <div key={s.host} className="site-inline">
                    <span className="host">
                      <span className="dot" style={{ background: 'var(--fg-dim)' }} />
                      {s.host}
                    </span>
                    <span className="skeleton-block s-val" />
                  </div>
                ))}
              </div>
            </MetricCard>
          </>
        )}
      </div>
    );
  }

  // ── State 2: idle — show the two action buttons ──────────
  // `useExistingResult` short-circuits the idle branch so the cached
  // verdict drives the full result panel (State 3) below — title,
  // channel, signals, ring all populated from the saved scan, instead
  // of falling through to a paused/idle card or a small dismiss-able
  // text-result card.
  if (!scanned && !useExistingResult) {
    // Surface the most recent scan failure (e.g. "Video too long",
    // "Couldn't fetch the video") instead of silently falling back to
    // the generic idle UI. User clicks "Try again" → re-runs the
    // page-level scan; "Dismiss" → back to the regular idle state.
    if (scanError) {
      return (
        <div className="panel panel-centered">
          <ScanFailedCard
            error={scanError}
            onRetry={() => {
              clearScanError();
              triggerPageScan();
            }}
            onDismiss={clearScanError}
          />
        </div>
      );
    }

    // If the user has just run a right-click text scan, surface that
    // result here instead of the generic "Website detected" UI. The
    // close button on the card flips dismissedScanId, restoring the
    // original idle state below until the next text scan arrives.
    // Gated to non-social pages — on YT/IG/FB the fresh scan flow
    // owns the drawer; a stale text-scan card there is confusing.
    if (showTextResult && latestTextScan) {
      return (
        <div className="panel panel-centered">
          <TextScanResultView
            scan={latestTextScan}
            onDismiss={dismissTextResult}
          />
        </div>
      );
    }

    const platformShort = platformLabel(platform).replace(' mode', '');
    const surfaceWord = surface ?? '';
    const noun = content ? contentNoun(platform) : 'page';

    // ── Manual scan-mode override ──
    if (manualMode && (isSocial || !!siteMatch || !!host)) {
      const switchAndScan = () => {
        setScanMode('allowlist');
        triggerPageScan();
      };
      return (
        <div className="panel panel-centered">
            <section className="card action-card action-paused">
            <div className="action-head">
              <div className="action-icon">
                <Icon name="pause" size={18} />
              </div>
              <div className="action-copy">
                <div className="action-title">Manual scan mode is on</div>
                <div className="action-host mono">auto-scan disabled</div>
              </div>
            </div>
            <p className="action-desc">
              {`heynotai is set to scan only when you ask. Switch to allow-list to scan ${
                isSocial && surface
                  ? `${platformShort} ${surfaceWord}`
                  : 'enabled platforms and sites'
              } automatically, or run a one-time check on this ${noun}.`}
            </p>
            <div className="action-btns">
              <button className="btn-primary" onClick={switchAndScan}>
                <Icon name="refresh" size={14} />
                Switch to allow-list & scan
              </button>
              <button className="btn-outline" onClick={triggerPageScan}>
                <Icon name="sparkle" size={14} />
                Run a one-time check
              </button>
            </div>
          </section>
        </div>
      );
    }

    // ── Platform-paused / site-paused (existing behavior) ──
    if (isPaused) {
      const pausedLabel = platformPaused
        ? platformShort
        : (siteMatch?.host ?? hostLabel);
      const activate = () => {
        if (platformPaused) setPlatformEnabled(platform as PlatformKey, true);
        else if (pausedSite && siteMatch) setSiteEnabledByHost(siteMatch.host, true);
        triggerPageScan();
      };
      const activateLabel = `Activate ${pausedLabel}`;
      return (
        <div className="panel panel-centered">
            <section className="card action-card action-paused">
            <div className="action-head">
              <div className="action-icon">
                <Icon name="pause" size={18} />
              </div>
              <div className="action-copy">
                <div className="action-title">{pausedLabel} is off</div>
                <div className="action-host mono">
                  {platformPaused ? 'platform deactivated' : 'site deactivated'}
                </div>
              </div>
            </div>
            <p className="action-desc">
              {`Auto-scan is off for ${pausedLabel}. Activate it to scan every ${noun} automatically, or run a one-time check now.`}
            </p>
            <div className="action-btns">
              <button className="btn-primary" onClick={activate}>
                <Icon name="refresh" size={14} />
                {activateLabel}
              </button>
              <button className="btn-outline" onClick={triggerPageScan}>
                <Icon name="sparkle" size={14} />
                Check once without activating
              </button>
            </div>
          </section>
        </div>
      );
    }

    // ── Surface-off (platform on but specific surface toggle off) ──
    if (surfaceOff && surface) {
      const activateSurface = () => {
        setPlatformSurface(
          platform as PlatformKey,
          surface as SurfaceKey<PlatformKey>,
          true,
        );
        triggerPageScan();
      };
      return (
        <div className="panel panel-centered">
            <section className="card action-card action-paused">
            <div className="action-head">
              <div className="action-icon">
                <Icon name="pause" size={18} />
              </div>
              <div className="action-copy">
                <div className="action-title">
                  {`${platformShort} ${surfaceWord} is off`}
                </div>
                <div className="action-host mono">surface paused</div>
              </div>
            </div>
            <p className="action-desc">
              {`Auto-scan is off for ${platformShort} ${surfaceWord}. Activate it to scan every ${noun} on this surface, or run a one-time check now.`}
            </p>
            <div className="action-btns">
              <button className="btn-primary" onClick={activateSurface}>
                <Icon name="refresh" size={14} />
                {`Activate ${surfaceWord}`}
              </button>
              <button className="btn-outline" onClick={triggerPageScan}>
                <Icon name="sparkle" size={14} />
                Check once without activating
              </button>
            </div>
          </section>
        </div>
      );
    }

    // ── Default: not paused, not manual, surface (if any) is on ──
    return (
      <div className="panel panel-centered">
        <section className="card action-card">
          <div className="action-head">
            <div className="action-icon">
              <Icon name={isSocial ? platform : 'globe'} size={18} />
            </div>
            <div className="action-copy">
              <div className="action-title">
                {content
                  ? content.title
                  : isSocial ? `${platformLabel(platform)} detected` : 'Website detected'}
              </div>
              <div className="action-host mono">
                {content ? `${content.author} · ${content.meta}` : hostLabel}
              </div>
            </div>
          </div>
          <p className="action-desc">
            {content
              ? `Run an AI-content check on this ${noun}, or add ${platformShort} to your allow-list so future ${noun}s are scanned automatically.`
              : 'Run an AI-content check on this page, or add it to your allow-list so future visits are scanned automatically.'}
          </p>
          <div className="action-btns">
            <button className="btn-primary" onClick={triggerPageScan}>
              <Icon name="sparkle" size={14} />
              Check this page
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                if (host) addSite(host);
                triggerPageScan();
              }}
            >
              <Icon name="plus" size={14} />
              Add to allow-list
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ── State 3: result ──────────────────────────────────────
  return (
    <div className="panel panel-no-stagger">
      <div className="result-fade">
        <MetricCard
          title={title}
          action={
            useExistingResult ? (
              <button
                type="button"
                className="ghost-btn"
                title="Run a fresh check on this video"
                onClick={() => {
                  if (existingScan) setDismissedScanId(existingScan.id);
                  triggerPageScan();
                }}
              >
                <Icon name="refresh" size={11} />
                Re-scan
              </button>
            ) : (
              <span className="card-action-mono">{hostLabel}</span>
            )
          }
        >
          <div className={`page-summary verdict-${pageVerdict}`}>
            <RingScore score={displayed} verdict={pageVerdict} size={80} />
            <div className="summary-copy">
              <div className="label">
                {content ? `${contentNoun(platform)} AI-likelihood` : 'Page AI-likelihood'}{' '}
                <Icon name="info" size={12} />
              </div>
              <div className="score">
                {displayed}% <span className={`verdict-tag ${pageVerdict}`}>likely AI</span>
              </div>
              <div className="sub">{content ? content.tagline : '4 of 6 posts flagged in view'}</div>
            </div>
          </div>
          {content && content.title && content.title !== '—' && (
            <div className="page-title-line" title={content.title}>
              {content.title}
            </div>
          )}
          <div>
            {content
              ? content.signals.map((s, i) => (
                  <Row
                    key={i}
                    label={s.label}
                    value={
                      s.verdict
                        ? <span style={{ color: colorVarOf(s.verdict) }}>{s.value}</span>
                        : s.value
                    }
                    hint={s.hint ? `(${s.hint})` : undefined}
                  />
                ))
              : (<>
                  <Row label="Scanned items" value="128" />
                  <Row label="Flagged items" value="47" hint="(37%)" />
                  <Row label="Confidence avg" value="0.81" />
                  <Row label="Scan time" value="1.4s" />
                </>)
            }
          </div>
        </MetricCard>

        {content ? (
          <CreatorCard content={content} platform={platform} />
        ) : (
          <>
            <MetricCard
              title="By content type"
              action={<button className="ghost-btn"><Icon name="filter" size={11} /> Filter</button>}
            >
              <div>
                {BREAKDOWN.map(b => {
                  const pct = Math.round((b.flagged / b.total) * 100);
                  const v = verdictOf(pct);
                  const color = colorVarOf(v);
                  return (
                    <div key={b.kind} className="breakdown-row">
                      <div className="br-icon"><Icon name={b.kind} size={14} /></div>
                      <div className="br-body">
                        <div className="br-head">
                          <span className="br-name">{b.label}</span>
                          <span className="br-count">
                            <span className="hit" style={{ color }}>{b.flagged}</span>/{b.total}
                          </span>
                        </div>
                        <div className="br-track">
                          <div className="br-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                      <MiniSpark data={b.spark} verdict={v} />
                    </div>
                  );
                })}
              </div>
            </MetricCard>

            <MetricCard
              title="Watching"
              action={<a className="link-action">Manage →</a>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {WATCHING.map(s => (
                  <div key={s.host} className="site-inline">
                    <span className="host">
                      <span className="dot" style={{ background: s.status === 'paused' ? 'var(--fg-dim)' : 'var(--human)' }} />
                      {s.host}
                    </span>
                    <span className="count">
                      {s.status === 'paused' ? 'paused' : `${s.count} scanned`}
                    </span>
                  </div>
                ))}
              </div>
            </MetricCard>
          </>
        )}
      </div>
    </div>
  );
}
