import { useEffect, useMemo, useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Chip } from '@/components/Chip';
import { Dropdown } from '@/components/Dropdown';
import { Donut } from '@/components/Donut';
import { AreaChart } from '@/components/AreaChart';
import { Histogram } from '@/components/Histogram';
import { MiniSpark } from '@/components/MiniSpark';
import {
  getStats,
  type Range,
  type Scope,
  SCOPE_LABELS,
  RANGE_LABELS,
} from '@/lib/stats-data';
import { usePlatform } from '@/lib/platform';

const SCOPE_META: { value: Scope; label: string; iconName: IconName }[] = [
  { value: 'all',       label: SCOPE_LABELS.all,       iconName: 'globe' },
  { value: 'websites',  label: SCOPE_LABELS.websites,  iconName: 'layers' },
  { value: 'social',    label: SCOPE_LABELS.social,    iconName: 'user' },
  { value: 'facebook',  label: SCOPE_LABELS.facebook,  iconName: 'facebook' },
  { value: 'youtube',   label: SCOPE_LABELS.youtube,   iconName: 'youtube' },
  { value: 'instagram', label: SCOPE_LABELS.instagram, iconName: 'instagram' },
];

const SCOPE_OPTIONS = SCOPE_META.map(o => ({
  value: o.value,
  label: o.label,
  icon: <Icon name={o.iconName} size={12} />,
}));

const RANGES: Range[] = ['today', '7d', '30d', 'all'];

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toString();
}

function verdictOf(pct: number): 'ai' | 'mixed' | 'human' {
  return pct >= 50 ? 'ai' : pct >= 25 ? 'mixed' : 'human';
}

function colorVarOf(v: 'ai' | 'mixed' | 'human') {
  return v === 'ai' ? 'var(--ai)' : v === 'human' ? 'var(--human)' : 'var(--mixed)';
}

function platformToScope(p: string): Scope | null {
  if (p === 'facebook' || p === 'youtube' || p === 'instagram') return p;
  return null;
}

function platformIcon(key: 'facebook' | 'youtube' | 'instagram' | 'other'): IconName {
  if (key === 'other') return 'globe';
  return key;
}

function exportCsv(rows: string[][]) {
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `heynotai-stats-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Stats() {
  const { platform } = usePlatform();
  const defaultScope: Scope = platformToScope(platform) ?? 'all';
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [range, setRange] = useState<Range>('30d');

  // Keep scope in sync if user opens popup on a new platform
  useEffect(() => {
    const s = platformToScope(platform);
    if (s) setScope(s);
  }, [platform]);

  const stats = useMemo(() => getStats(scope, range), [scope, range]);

  const tokensPct = Math.min(100, Math.round((stats.totals.tokensUsed / stats.totals.tokensQuota) * 100));
  const verdictTotal = stats.verdict.human + stats.verdict.mixed + stats.verdict.ai || 1;
  const humanPct = Math.round((stats.verdict.human / verdictTotal) * 100);
  const mixedPct = Math.round((stats.verdict.mixed / verdictTotal) * 100);
  const aiPct = 100 - humanPct - mixedPct;

  const aboveBaseline = stats.totals.aiPercent >= stats.baselineAiPercent;

  function handleExport() {
    const rows: string[][] = [
      ['scope', stats.scope],
      ['range', stats.range],
      ['scans', String(stats.totals.scans)],
      ['flagged', String(stats.totals.flagged)],
      ['ai_percent', String(stats.totals.aiPercent)],
      ['tokens_used', String(stats.totals.tokensUsed)],
      ['tokens_quota', String(stats.totals.tokensQuota)],
      [],
      ['day', 'human', 'mixed', 'ai'],
      ...stats.trend.map(t => [t.day, String(t.human), String(t.mixed), String(t.ai)]),
      [],
      ['platform', 'scans', 'ai_percent'],
      ...stats.byPlatform.map(p => [p.label, String(p.scans), String(p.aiPercent)]),
      [],
      ['host', 'scans', 'ai_percent'],
      ...stats.topSites.map(s => [s.host, String(s.scans), String(s.aiPercent)]),
    ];
    exportCsv(rows);
  }

  return (
    <div className="panel stats-panel">
      {/* ── Scope + range header ─────────────────────── */}
      <div className="stats-filters">
        <Dropdown
          value={scope}
          options={SCOPE_OPTIONS}
          onChange={setScope}
          ariaLabel="Change scope"
          buttonLabel={(o) => (
            <>
              {o.icon}
              <span>{o.label}</span>
            </>
          )}
        />
        <div className="chips" style={{ margin: 0 }}>
          {RANGES.map(r => (
            <Chip key={r} active={range === r} onClick={() => setRange(r)}>
              {RANGE_LABELS[r]}
            </Chip>
          ))}
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Total scans</div>
          <div className="kpi-value">{formatNumber(stats.totals.scans)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Flagged</div>
          <div className="kpi-value" style={{ color: 'var(--ai-ink)' }}>
            {formatNumber(stats.totals.flagged)}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">AI %</div>
          <div className="kpi-value">
            {stats.totals.aiPercent}<span className="kpi-unit">%</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Tokens</div>
          <div className="kpi-value kpi-value-sm">
            {formatNumber(stats.totals.tokensUsed)}
            <span className="kpi-unit"> / {formatNumber(stats.totals.tokensQuota)}</span>
          </div>
          <div className="kpi-track">
            <div className="kpi-fill" style={{ width: `${tokensPct}%` }} />
          </div>
        </div>
      </div>

      {/* ── Verdict donut ─────────────────────────────── */}
      <MetricCard title="Verdict breakdown">
        <div className="donut-row">
          <Donut
            human={stats.verdict.human}
            mixed={stats.verdict.mixed}
            ai={stats.verdict.ai}
            size={96}
          />
          <div className="legend">
            <div className="legend-row">
              <span className="legend-dot" style={{ background: 'var(--human)' }} />
              <span className="legend-label">Human</span>
              <span className="legend-value">{humanPct}%</span>
            </div>
            <div className="legend-row">
              <span className="legend-dot" style={{ background: 'var(--mixed)' }} />
              <span className="legend-label">Mixed</span>
              <span className="legend-value">{mixedPct}%</span>
            </div>
            <div className="legend-row">
              <span className="legend-dot" style={{ background: 'var(--ai)' }} />
              <span className="legend-label">AI</span>
              <span className="legend-value">{aiPct}%</span>
            </div>
          </div>
        </div>
      </MetricCard>

      {/* ── Trend ─────────────────────────────────────── */}
      <MetricCard
        title="Scans per day"
        action={<span className="card-action-mono">{stats.trend.length}d</span>}
      >
        <AreaChart
          height={72}
          series={[
            { values: stats.trend.map(t => t.human), color: 'var(--human)' },
            { values: stats.trend.map(t => t.mixed), color: 'var(--mixed)' },
            { values: stats.trend.map(t => t.ai),    color: 'var(--ai)' },
          ]}
        />
      </MetricCard>

      {/* ── By content type ──────────────────────────── */}
      <MetricCard title="By content type">
        <div>
          {stats.byType.map(b => {
            const pct = Math.round((b.flagged / b.total) * 100);
            const v = verdictOf(pct);
            const color = colorVarOf(v);
            return (
              <div key={b.kind} className="breakdown-row">
                <div className="br-icon"><Icon name={b.kind} size={14} /></div>
                <div className="br-body">
                  <div className="br-head">
                    <span className="br-name" style={{ textTransform: 'capitalize' }}>{b.kind}</span>
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

      {/* ── By platform (clickable drill-down) ───────── */}
      <MetricCard title="By platform">
        <div>
          {stats.byPlatform.map(p => {
            const v = verdictOf(p.aiPercent);
            const isDrillable = p.key !== 'other';
            return (
              <button
                key={p.key}
                type="button"
                className="platform-row"
                disabled={!isDrillable}
                onClick={() => isDrillable && setScope(p.key as Scope)}
              >
                <div className="site-globe"><Icon name={platformIcon(p.key)} size={13} /></div>
                <div className="site-body">
                  <div className="site-host" style={{ fontFamily: 'inherit' }}>{p.label}</div>
                  <div className="site-meta">
                    {formatNumber(p.scans)} scans · <span style={{ color: colorVarOf(v) }}>{p.aiPercent}% AI</span>
                  </div>
                </div>
                <MiniSpark data={p.spark} verdict={v} width={72} height={24} />
              </button>
            );
          })}
        </div>
      </MetricCard>

      {/* ── Top sites ─────────────────────────────────── */}
      <MetricCard title="Top sites">
        <div>
          {stats.topSites.map((s, i) => {
            const v = verdictOf(s.aiPercent);
            return (
              <div key={s.host} className="row" style={{ borderTop: i === 0 ? 'none' : undefined }}>
                <span className="row-label" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg)' }}>
                  {s.host}
                </span>
                <span className="row-value">
                  {formatNumber(s.scans)}
                  <span className={`verdict-tag ${v}`} style={{ marginLeft: 6 }}>{s.aiPercent}% AI</span>
                </span>
              </div>
            );
          })}
        </div>
      </MetricCard>

      {/* ── Token usage ───────────────────────────────── */}
      <MetricCard title="Token usage"
        action={<span className="card-action-mono">${stats.tokens.costUsd.toFixed(2)}</span>}
      >
        <div className="token-bar">
          <div className="token-bar-fill" style={{ width: `${tokensPct}%` }} />
        </div>
        <div className="token-caption">
          {formatNumber(stats.totals.tokensUsed)} / {formatNumber(stats.totals.tokensQuota)} tokens ({tokensPct}%)
        </div>
        <div>
          <div className="row"><span className="row-label">Text</span>  <span className="row-value">{formatNumber(stats.tokens.text)}</span></div>
          <div className="row"><span className="row-label">Image</span> <span className="row-value">{formatNumber(stats.tokens.image)}</span></div>
          <div className="row"><span className="row-label">Audio</span> <span className="row-value">{formatNumber(stats.tokens.audio)}</span></div>
          <div className="row"><span className="row-label">Video</span> <span className="row-value">{formatNumber(stats.tokens.video)}</span></div>
        </div>
      </MetricCard>

      {/* ── Confidence distribution ───────────────────── */}
      <MetricCard
        title="Confidence distribution"
        action={<span className="card-action-mono">0 – 100%</span>}
      >
        <Histogram buckets={stats.confidence} height={64} />
      </MetricCard>

      {/* ── Model usage ───────────────────────────────── */}
      <MetricCard title="Model usage">
        <div>
          {stats.modelUsage.map(m => (
            <div key={m.group} className="row">
              <span className="row-label">
                <Icon name={m.group} size={12} />
                {m.modelName}
              </span>
              <span className="row-value">{formatNumber(m.scans)}</span>
            </div>
          ))}
        </div>
      </MetricCard>

      {/* ── Top flagged authors ───────────────────────── */}
      <MetricCard title="Top flagged authors">
        <div>
          {stats.topAuthors.map((a, i) => (
            <div key={a.name} className="row" style={{ borderTop: i === 0 ? 'none' : undefined }}>
              <span className="row-label" style={{ color: 'var(--fg)' }}>{a.name}</span>
              <span className="row-value">{a.flagged}</span>
            </div>
          ))}
        </div>
      </MetricCard>

      {/* ── Streak + baseline comparison ──────────────── */}
      <div className="insight-row">
        <div className="insight-pill">
          <Icon name="bolt" size={12} />
          <span>{stats.streakDays}-day streak</span>
        </div>
        <div className={`insight-pill ${aboveBaseline ? 'above' : 'below'}`}>
          <Icon name={aboveBaseline ? 'sparkle' : 'shield'} size={12} />
          <span>
            {aboveBaseline ? 'Above' : 'Below'} typical · {stats.baselineAiPercent}%
          </span>
        </div>
      </div>

      {/* ── Export ────────────────────────────────────── */}
      <button className="load-more" type="button" onClick={handleExport}>
        <Icon name="refresh" size={12} /> Export {stats.trend.length}d as CSV
      </button>
    </div>
  );
}
