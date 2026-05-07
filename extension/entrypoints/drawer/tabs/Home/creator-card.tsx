import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Row } from '@/components/Row';
import type { PlatformContent, Creator } from '@/lib/sample-data';
import type { Platform } from '@/lib/platform';
import type { Verdict } from '@/lib/types';
import { colorVarOf, platformIcon } from './helpers';

export function CreatorCard({
  content, platform,
}: { content: PlatformContent; platform: Platform }) {
  const c: Creator = content.creator;
  const v: Verdict = c.avgAi >= 50 ? 'ai' : c.avgAi >= 25 ? 'mixed' : 'human';
  // We only have historical-stat data for the sample-driven cards
  // (FB/IG). YouTube currently goes through real metadata (no stats
  // tracked yet), so `scanned === 0` is the signal to hide the stat
  // rows entirely instead of showing fake zeros.
  const hasStats = c.scanned > 0;
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
        {hasStats && <span className={`verdict-tag ${v}`}>{c.avgAi}% avg</span>}
      </div>
      {hasStats && (
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
      )}
    </MetricCard>
  );
}
