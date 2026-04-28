import { useEffect, useMemo, useRef } from 'react';
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
import { useApp, type PlatformKey } from '@/lib/state';
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
  const { platform, host } = usePlatform();
  const {
    scanning, progress, scanned, startScan,
    scanMode, sites, platforms, addSite,
    setPlatformEnabled, setSiteEnabledByHost,
  } = useApp();

  const isSocial = platform !== 'other';
  const platformEnabled = isSocial ? platforms[platform] === true : false;
  const platformPaused = isSocial && !platformEnabled;

  const siteMatch = useMemo(
    () => host ? sites.find(s => hostMatches(s.host, host)) : undefined,
    [host, sites],
  );
  const whitelistedSite = !!siteMatch && siteMatch.enabled;
  const pausedSite = !!siteMatch && !siteMatch.enabled;

  const covered = (isSocial && platformEnabled) || whitelistedSite;
  const isPaused = platformPaused || pausedSite;

  const autoScan =
    scanMode === 'everything' ||
    (scanMode === 'allowlist' && covered);

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
              <svg className="scan-ring-arc" width={80} height={80}>
                <circle cx={40} cy={40} r={35} fill="none"
                  stroke={colorVarOf(pageVerdict)} strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={`${ARC} ${CIRC - ARC}`} />
              </svg>
              <div className="ring-label mono">
                <span>{Math.round(progress)}<span className="pct">%</span></span>
              </div>
            </div>
            <div className="summary-copy">
              <div className="label">
                Analyzing {contentNoun(platform)}… <Icon name="info" size={12} />
              </div>
              <div className="score scan-score">
                <span className="scan-pct">{Math.round(progress)}%</span>
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
    const pausedLabel = platformPaused
      ? platformLabel(platform).replace(' mode', '')
      : (siteMatch?.host ?? hostLabel);

    const resume = () => {
      if (platformPaused) setPlatformEnabled(platform as PlatformKey, true);
      else if (pausedSite && siteMatch) setSiteEnabledByHost(siteMatch.host, true);
      startScan();
    };

    return (
      <div className="panel panel-centered">
        <section className={`card action-card${isPaused ? ' action-paused' : ''}`}>
          <div className="action-head">
            <div className="action-icon">
              <Icon name={isPaused ? 'pause' : (isSocial ? platform : 'globe')} size={18} />
            </div>
            <div className="action-copy">
              <div className="action-title">
                {isPaused
                  ? `${pausedLabel} is paused`
                  : content
                    ? content.title
                    : isSocial ? `${platformLabel(platform)} detected` : 'Website detected'}
              </div>
              <div className="action-host mono">
                {isPaused
                  ? (platformPaused ? 'paused platform' : 'paused in allow-list')
                  : content ? `${content.author} · ${content.meta}` : hostLabel}
              </div>
            </div>
          </div>

          <p className="action-desc">
            {isPaused
              ? `Scanning is paused for ${pausedLabel}. Resume it to scan automatically on every visit, or run a one-time check now.`
              : content
                ? `Run an AI-content check on this ${contentNoun(platform)}, or add ${platformLabel(platform).replace(' mode', '')} to your allow-list so future ${contentNoun(platform)}s are scanned automatically.`
                : 'Run an AI-content check on this page, or add it to your allow-list so future visits are scanned automatically.'}
          </p>

          <div className="action-btns">
            {isPaused ? (
              <>
                <button className="btn-primary" onClick={resume}>
                  <Icon name="refresh" size={14} />
                  Resume scanning
                </button>
                <button className="btn-outline" onClick={startScan}>
                  <Icon name="sparkle" size={14} />
                  Check once without resuming
                </button>
              </>
            ) : (
              <>
                <button className="btn-primary" onClick={startScan}>
                  <Icon name="sparkle" size={14} />
                  Check this page
                </button>
                <button
                  className="btn-outline"
                  onClick={() => {
                    if (host) addSite(host);
                    startScan();
                  }}
                >
                  <Icon name="plus" size={14} />
                  Add to allow-list
                </button>
              </>
            )}
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
