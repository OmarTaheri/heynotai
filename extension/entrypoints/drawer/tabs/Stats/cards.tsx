import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Donut } from '@/components/Donut';
import { AreaChart } from '@/components/AreaChart';
import { Histogram } from '@/components/Histogram';
import { MiniSpark } from '@/components/MiniSpark';
import type { Scope, StatsBundle } from '@/lib/stats-data';
import { colorVarOf, formatNumber, platformIcon, verdictOf } from './helpers';

export function VerdictDonutCard({
  stats, humanPct, mixedPct, aiPct,
}: {
  stats: StatsBundle;
  humanPct: number;
  mixedPct: number;
  aiPct: number;
}) {
  return (
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
  );
}

export function TrendCard({ stats }: { stats: StatsBundle }) {
  return (
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
  );
}

export function ByContentTypeCard({ stats }: { stats: StatsBundle }) {
  return (
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
  );
}

export function ByPlatformCard({
  stats, setScope,
}: { stats: StatsBundle; setScope: (s: Scope) => void }) {
  return (
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
  );
}

export function TopSitesCard({ stats }: { stats: StatsBundle }) {
  return (
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
  );
}

export function TokenUsageCard({
  stats, tokensPct,
}: { stats: StatsBundle; tokensPct: number }) {
  return (
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
  );
}

export function ConfidenceDistributionCard({ stats }: { stats: StatsBundle }) {
  return (
    <MetricCard
      title="Confidence distribution"
      action={<span className="card-action-mono">0 – 100%</span>}
    >
      <Histogram buckets={stats.confidence} height={64} />
    </MetricCard>
  );
}

export function ModelUsageCard({ stats }: { stats: StatsBundle }) {
  return (
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
  );
}

export function TopAuthorsCard({ stats }: { stats: StatsBundle }) {
  return (
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
  );
}

export function InsightRow({
  stats, aboveBaseline,
}: { stats: StatsBundle; aboveBaseline: boolean }) {
  return (
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
  );
}
