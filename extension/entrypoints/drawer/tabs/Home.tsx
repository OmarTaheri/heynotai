import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { RingScore } from '@/components/RingScore';
import { Row } from '@/components/Row';
import { MiniSpark } from '@/components/MiniSpark';
import {
  BREAKDOWN, WATCHING,
  YOUTUBE_CONTENT, FACEBOOK_CONTENT, INSTAGRAM_CONTENT,
  type PlatformContent, type Hotspot, type Creator,
} from '@/lib/sample-data';
import { usePlatform, platformLabel, type Platform } from '@/lib/platform';
import { useApp, type PlatformKey, type SurfaceKey } from '@/lib/state';
import { useAuth } from '@/lib/auth-state';
import { pb } from '@/lib/pocketbase';
import { listScans, FRONTEND_URL } from '@/lib/scans-api';
import type { Scan } from '@/lib/scans-api';
import type { Verdict } from '@/lib/types';

function platformIcon(p: string): IconName {
  return p === 'facebook' || p === 'youtube' || p === 'instagram'
    ? (p as IconName)
    : 'globe';
}

function contentFor(p: Platform): PlatformContent | null {
  if (p === 'youtube')   return YOUTUBE_CONTENT;
  if (p === 'facebook')  return FACEBOOK_CONTENT;
  if (p === 'instagram') return INSTAGRAM_CONTENT;
  return null;
}

function contentNoun(p: Platform): string {
  if (p === 'youtube')   return 'video';
  if (p === 'instagram') return 'reel';
  if (p === 'facebook')  return 'post';
  return 'page';
}

function verdictOf(pct: number): Verdict {
  return pct >= 50 ? 'ai' : pct >= 25 ? 'mixed' : 'human';
}

function colorVarOf(v: Verdict) {
  return v === 'ai' ? 'var(--ai)' : v === 'human' ? 'var(--human)' : 'var(--mixed)';
}

/** Subscribes to the scans collection and returns the most recent
 *  text-selection scan (origin='ext', type='txt', status='done') for
 *  the current user. Powers the "Latest text check" card so a scan
 *  triggered via the right-click context menu surfaces in Home the
 *  next time the drawer opens. */
function useLatestTextScan(): Scan | null {
  const { user } = useAuth();
  const [scan, setScan] = useState<Scan | null>(null);

  useEffect(() => {
    if (!user) {
      setScan(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Fetch the most recent done text scan as the initial state.
        const page = await listScans({ perPage: 1, type: 'txt', origin: 'ext' });
        if (cancelled) return;
        const first = page.items[0];
        if (first && first.status === 'done') setScan(first);
      } catch {
        // Best-effort — silent failure leaves the card hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let unsubscribed = false;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const u = await pb.collection('scans').subscribe('*', (e) => {
          const r = e.record as unknown as Scan & { userId?: string };
          if (!r || r.userId !== user.id) return;
          if (r.origin !== 'ext' || r.type !== 'txt') return;
          if (r.status !== 'done') return;
          setScan((prev) => {
            if (!prev) return r;
            return new Date(r.created) > new Date(prev.created) ? r : prev;
          });
        });
        if (unsubscribed) {
          void pb.collection('scans').unsubscribe('*');
          return;
        }
        unsub = () => {
          // The subscribe callback returns a function in the PB SDK
          // that unsubs only this listener. Defensive cast for older
          // SDK versions where the return type is `Promise<void>`.
          const result = u as unknown;
          if (typeof result === 'function') (result as () => void)();
          else void pb.collection('scans').unsubscribe('*');
        };
      } catch {
        /* realtime unavailable — fall back to the initial fetch */
      }
    })();
    return () => {
      unsubscribed = true;
      if (unsub) unsub();
    };
  }, [user]);

  return scan;
}

function verdictFromScan(scan: Scan): Verdict {
  const v = scan.verdict;
  if (v === 'human' || v === 'ai' || v === 'mixed') return v;
  return 'mixed';
}

function snippetFromScan(scan: Scan, max = 80): string {
  const title = scan.title?.trim();
  if (title) return title.length > max ? `${title.slice(0, max - 1)}…` : title;
  return scan.wordCount > 0
    ? `${scan.wordCount.toLocaleString()} words`
    : 'Text selection';
}

function relativeTime(iso: string): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const delta = Date.now() - ts;
  const sec = Math.round(delta / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? 'yesterday' : `${day}d ago`;
}

function openEditor(id: string) {
  const url = `${FRONTEND_URL}/editor/${encodeURIComponent(id)}`;
  if (chrome?.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener,noreferrer');
}

function verdictHeadline(scan: Scan): string {
  switch (scan.verdict) {
    case 'human': return 'human-written';
    case 'ai':    return 'AI-generated';
    case 'mixed': return 'mixed signals';
    default:      return 'unclear';
  }
}

function detectionsCount(scan: Scan): number {
  return Array.isArray(scan.flags) ? scan.flags.length : 0;
}

/** Primary text-scan result card — replaces the "Website detected /
 *  Run a check / Add to allow-list" idle UI when the user has just
 *  triggered a right-click text scan. Dismissing it (× button) restores
 *  the original idle UI for the current scan id. */
function TextScanResultView({
  scan,
  onDismiss,
}: {
  scan: Scan;
  onDismiss: () => void;
}) {
  const verdict = verdictFromScan(scan);
  const aiPct = Math.max(0, Math.min(100, Math.round(scan.aiPct)));
  const detections = detectionsCount(scan);
  const headline = verdictHeadline(scan);
  const when = relativeTime(scan.created);
  return (
    <section className={`card text-result-card verdict-${verdict}`}>
      <button
        type="button"
        className="text-result-close"
        aria-label="Dismiss text scan result"
        title="Dismiss"
        onClick={onDismiss}
      >
        <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor"
                strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      </button>
      <div className="text-result-head">
        <RingScore score={aiPct} verdict={verdict} size={84} />
        <div className="text-result-copy">
          <div className="text-result-headline">{headline}</div>
          <div className="text-result-meta mono">
            {detections.toLocaleString()} detection{detections === 1 ? '' : 's'}
          </div>
          <div className="text-result-when mono">{when}</div>
        </div>
      </div>
      <div className="text-result-bar-row">
        <span className="text-result-bar-label">AI-generated</span>
        <div className="text-result-bar" aria-hidden="true">
          <div
            className={`text-result-bar-fill verdict-${verdict}`}
            style={{ width: `${aiPct}%` }}
          />
        </div>
        <span className="text-result-bar-pct mono">{aiPct}%</span>
      </div>
      <button
        type="button"
        className="text-result-cta"
        onClick={() => openEditor(scan.id)}
      >
        Open in editor
        <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
          <path d="M6 3h7v7M13 3l-9 9" stroke="currentColor"
                strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  );
}

function hostMatches(pattern: string, host: string): boolean {
  const p = pattern.replace(/^www\./, '');
  const h = host.replace(/^www\./, '');
  if (p === h) return true;
  if (p.startsWith('*.')) {
    const bare = p.slice(2);
    return h === bare || h.endsWith('.' + bare);
  }
  return h === p || h.endsWith('.' + p);
}

function ContentHeader({
  content, platform, skeleton = false,
}: { content: PlatformContent; platform: Platform; skeleton?: boolean }) {
  return (
    <section className={`card content-header plat-${platform}`}>
      <div className="ch-row">
        <div className="ch-thumb">
          <Icon name={content.kind} size={16} />
        </div>
        <div className="ch-body">
          <div className="ch-title" title={content.title}>{content.title}</div>
          <div className="ch-meta mono">
            <span className="ch-author">{content.author}</span>
            <span className="ch-dot">·</span>
            <span>{content.meta}</span>
          </div>
        </div>
        {skeleton ? (
          <span className="ch-badge skeleton-block s-chip" />
        ) : (
          <span className={`ch-badge verdict-tag ${content.verdict}`}>
            <Icon name={platformIcon(platform)} size={10} />
            {platformLabel(platform).replace(' mode', '')}
          </span>
        )}
      </div>
    </section>
  );
}

export function Home() {
  const { platform, surface, host, tabId } = usePlatform();
  const {
    scanning, progress, scanned, startScan,
    scanMode, setScanMode, sites, platforms, addSite,
    setPlatformEnabled, setPlatformSurface, setSiteEnabledByHost,
  } = useApp();
  const latestTextScan = useLatestTextScan();
  const [dismissedScanId, setDismissedScanId] = useState<string | null>(null);
  const showTextResult =
    !!latestTextScan && latestTextScan.id !== dismissedScanId;
  const dismissTextResult = () => {
    if (latestTextScan) setDismissedScanId(latestTextScan.id);
  };

  const isSocial = platform !== 'other';
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

  const surfaceCovered = isSocial && platformEnabled
    ? (surface ? surfaceEnabled : true)
    : false;
  const covered = surfaceCovered || whitelistedSite;
  const isPaused = platformPaused || pausedSite;
  const manualMode = scanMode === 'manual';

  const autoScan =
    !manualMode && (
      scanMode === 'everything' ||
      (scanMode === 'allowlist' && covered)
    );

  // Send the page-level scan trigger to the content script alongside the
  // drawer's own scanning UI — keeps the host page's overlay in sync.
  const triggerPageScan = () => {
    if (tabId != null) {
      try {
        void chrome.tabs?.sendMessage(tabId, { type: 'MANUAL_SCAN' }).catch(() => {});
      } catch {}
    }
    startScan();
  };

  // Kick off an auto-scan when the popup opens on an already-covered site.
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (!host && !isSocial) return;
    if (autoScan && !scanning && !scanned) {
      autoFiredRef.current = true;
      startScan();
    }
  }, [autoScan, scanning, scanned, startScan, host, isSocial]);

  const content = contentFor(platform);
  const pageScore = content?.score ?? 62;
  const pageVerdict: Verdict = content?.verdict ?? 'ai';

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
        {content && (
          <ContentHeader content={content} platform={platform} skeleton />
        )}
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
          <>
            <MetricCard
              title={content.hotspotLabel}
              action={<span className="skeleton-block s-chip" />}
            >
              {content.timelineTotal && (
                <div className="timeline">
                  <div className="timeline-track skeleton-bar" />
                  <div className="timeline-axis mono">
                    <span>0:00</span>
                    <span>{content.timelineTotal}</span>
                  </div>
                </div>
              )}
              <div>
                {content.hotspots.map((h, i) => (
                  <div key={i} className="hotspot-row">
                    <span className="hotspot-at mono">{h.at}</span>
                    <div className="hotspot-body">
                      <div className="hotspot-head">
                        <Icon name={h.kind} size={12} />
                        <span className="skeleton-block s-count" />
                      </div>
                      <div className="hotspot-track">
                        <div className="hotspot-fill skeleton-bar" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <span className="skeleton-block s-val" />
                  </div>
                ))}
              </div>
            </MetricCard>

            <MetricCard
              title={content.creatorCardTitle}
              action={<span className="skeleton-block s-chip" />}
            >
              <div className="creator-head">
                <div className={`creator-avatar plat-${platform}`}>
                  <Icon name={platformIcon(platform)} size={16} />
                </div>
                <div className="creator-copy">
                  <div className="skeleton-block s-score" style={{ height: 15, width: 130 }} />
                  <div className="skeleton-block s-sub" style={{ marginTop: 5 }} />
                </div>
                <span className="skeleton-block s-chip" />
              </div>
              <div>
                {['Content scanned', 'Flagged history', 'Avg AI-likelihood', 'Last checked'].map(lb => (
                  <div key={lb} className="row">
                    <span className="row-label">{lb}</span>
                    <span className="skeleton-block s-val" />
                  </div>
                ))}
              </div>
            </MetricCard>
          </>
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
  if (!scanned) {
    // If the user has just run a right-click text scan, surface that
    // result here instead of the generic "Website detected" UI. The
    // close button on the card flips dismissedScanId, restoring the
    // original idle state below until the next text scan arrives.
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
      const activateLabel = platformPaused
        ? `Activate ${pausedLabel}`
        : `Activate ${pausedLabel}`;
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
        {content && (
          <ContentHeader content={content} platform={platform} />
        )}
        <MetricCard
          title={title}
          action={<span className="card-action-mono">{hostLabel}</span>}
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
          <>
            <HotspotsCard content={content} />
            <CreatorCard content={content} platform={platform} />
          </>
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

function HotspotsCard({ content }: { content: PlatformContent }) {
  const hasTimeline = !!content.timelineTotal;
  const totalSecs = hasTimeline ? parseDuration(content.timelineTotal!) : 0;
  return (
    <MetricCard
      title={content.hotspotLabel}
      action={<span className="card-action-mono">{content.hotspots.length} flags</span>}
    >
      {hasTimeline && totalSecs > 0 && (
        <div className="timeline">
          <div className="timeline-track">
            {content.hotspots.map((h, i) => {
              const secs = parseDuration(h.at);
              if (Number.isNaN(secs)) return null;
              const pct = Math.max(0, Math.min(100, (secs / totalSecs) * 100));
              return (
                <span
                  key={i}
                  className={`timeline-marker v-${h.verdict}`}
                  style={{ left: `${pct}%` }}
                  title={`${h.at} · ${h.label}`}
                />
              );
            })}
          </div>
          <div className="timeline-axis mono">
            <span>0:00</span>
            <span>{content.timelineTotal}</span>
          </div>
        </div>
      )}
      <div>
        {content.hotspots.map((h, i) => (
          <div key={i} className="hotspot-row">
            <span className={`hotspot-at mono v-${h.verdict}`}>{h.at}</span>
            <div className="hotspot-body">
              <div className="hotspot-head">
                <Icon name={h.kind} size={12} />
                <span className="hotspot-label">{h.label}</span>
              </div>
              <div className="hotspot-track">
                <div
                  className="hotspot-fill"
                  style={{
                    width: `${h.confidence}%`,
                    background: colorVarOf(h.verdict),
                  }}
                />
              </div>
            </div>
            <span className={`hotspot-conf mono v-${h.verdict}`}>{h.confidence}%</span>
          </div>
        ))}
      </div>
    </MetricCard>
  );
}

function CreatorCard({
  content, platform,
}: { content: PlatformContent; platform: Platform }) {
  const c: Creator = content.creator;
  const v: Verdict = c.avgAi >= 50 ? 'ai' : c.avgAi >= 25 ? 'mixed' : 'human';
  return (
    <MetricCard
      title={content.creatorCardTitle}
      action={<a className="link-action">View all →</a>}
    >
      <div className="creator-head">
        <div className={`creator-avatar plat-${platform}`}>
          <Icon name={platformIcon(platform)} size={16} />
        </div>
        <div className="creator-copy">
          <div className="creator-name">
            {c.displayName}
            {c.verified && <span className="creator-verified" title="verified">✓</span>}
          </div>
          <div className="creator-meta mono">
            <span>{c.handle}</span>
            {c.sub && <><span className="ch-dot">·</span><span>{c.sub}</span></>}
          </div>
        </div>
        <span className={`verdict-tag ${v}`}>{c.avgAi}% avg</span>
      </div>
      <div>
        <Row label="Content scanned" value={String(c.scanned)} />
        <Row
          label="Flagged history"
          value={<span style={{ color: colorVarOf(v) }}>{c.flagged}</span>}
          hint={`(${Math.round((c.flagged / Math.max(1, c.scanned)) * 100)}%)`}
        />
        <Row label="Avg AI-likelihood" value={`${c.avgAi}%`} />
        <Row label="Last checked" value={c.lastChecked} />
      </div>
    </MetricCard>
  );
}

function parseDuration(s: string): number {
  const m = /^(\d+):(\d+)$/.exec(s);
  if (!m) return NaN;
  return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
}
