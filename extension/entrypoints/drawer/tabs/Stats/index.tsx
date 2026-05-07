import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { getStats, type Range, type Scope } from '@/lib/stats-data';
import { usePlatform } from '@/lib/platform';
import { exportCsv, platformToScope } from './helpers';
import { StatsFilters } from './Filters';
import { KpiStrip } from './KpiStrip';
import {
  ByContentTypeCard,
  ByPlatformCard,
  ConfidenceDistributionCard,
  InsightRow,
  ModelUsageCard,
  TokenUsageCard,
  TopAuthorsCard,
  TopSitesCard,
  TrendCard,
  VerdictDonutCard,
} from './cards';
import { ComingSoonOverlay } from './ComingSoonOverlay';

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

  // Lock body scroll while the Coming Soon overlay is shown.
  useEffect(() => {
    const body = document.querySelector<HTMLDivElement>('.body');
    body?.classList.add('is-coming-soon');
    return () => body?.classList.remove('is-coming-soon');
  }, []);

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
    <div className="coming-soon-wrap">
      <div className="coming-soon-content panel stats-panel" aria-hidden>
        <StatsFilters scope={scope} setScope={setScope} range={range} setRange={setRange} />
        <KpiStrip stats={stats} tokensPct={tokensPct} />
        <VerdictDonutCard
          stats={stats}
          humanPct={humanPct}
          mixedPct={mixedPct}
          aiPct={aiPct}
        />
        <TrendCard stats={stats} />
        <ByContentTypeCard stats={stats} />
        <ByPlatformCard stats={stats} setScope={setScope} />
        <TopSitesCard stats={stats} />
        <TokenUsageCard stats={stats} tokensPct={tokensPct} />
        <ConfidenceDistributionCard stats={stats} />
        <ModelUsageCard stats={stats} />
        <TopAuthorsCard stats={stats} />
        <InsightRow stats={stats} aboveBaseline={aboveBaseline} />
        <button className="load-more" type="button" onClick={handleExport}>
          <Icon name="refresh" size={12} /> Export {stats.trend.length}d as CSV
        </button>
      </div>
      <ComingSoonOverlay />
    </div>
  );
}
