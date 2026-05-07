import type { StatsBundle } from '@/lib/stats-data';
import { formatNumber } from './helpers';

export function KpiStrip({ stats, tokensPct }: { stats: StatsBundle; tokensPct: number }) {
  return (
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
  );
}
