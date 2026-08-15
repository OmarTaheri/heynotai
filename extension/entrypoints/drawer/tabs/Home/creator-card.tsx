import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import type { PageContent } from '@/lib/page-content';
import type { Platform } from '@/lib/platform';
import { platformIcon } from './helpers';

/** Channel/author card. Only renders what the host page actually
 *  exposed. The historical stat rows ("Content scanned", "Flagged
 *  history", "Avg AI-likelihood", "Last checked") used to be filled
 *  from fixtures — there is no per-creator history in the backend yet,
 *  so they are gone rather than faked. */
export function CreatorCard({
  content, platform,
}: { content: PageContent; platform: Platform }) {
  const c = content.creator;
  if (!c) return null;

  return (
    <MetricCard title={content.creatorCardTitle}>
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
            {c.handle && <span>{c.handle}</span>}
            {c.handle && c.sub && <span className="ch-dot">·</span>}
            {c.sub && <span>{c.sub}</span>}
          </div>
        </div>
      </div>
    </MetricCard>
  );
}
