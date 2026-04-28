import { Icon, type IconName } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Toggle } from '@/components/Toggle';
import { useApp, type ScanMode, type PlatformKey } from '@/lib/state';

const MODES: { key: ScanMode; label: string; hint: string }[] = [
  { key: 'allowlist',  label: 'Allowed platforms and websites', hint: 'scan only on enabled platforms and sites' },
  { key: 'manual',     label: 'Manual',                         hint: 'only when you click the extension' },
  { key: 'everything', label: 'Everything',                     hint: 'scan every site you visit — no allow-list' },
];

const PLATFORMS: { key: PlatformKey; label: string; icon: IconName; hint: string }[] = [
  { key: 'facebook',  label: 'Facebook',  icon: 'facebook',  hint: 'scan posts, reels, comments' },
  { key: 'youtube',   label: 'YouTube',   icon: 'youtube',   hint: 'scan videos, titles, comments' },
  { key: 'instagram', label: 'Instagram', icon: 'instagram', hint: 'scan posts, reels, captions' },
];

export function Sources() {
  const {
    scanMode, setScanMode,
    sites, toggleSiteAt, removeSiteAt,
    platforms, setPlatformEnabled,
  } = useApp();

  const everything = scanMode === 'everything';

  return (
    <div className="panel">
      <MetricCard title="Scan mode">
        <div>
          {MODES.map(m => {
            const danger = m.key === 'everything';
            const active = scanMode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                className={`radio-row${active ? ' active' : ''}${danger ? ' danger' : ''}`}
                onClick={() => setScanMode(m.key)}
              >
                <span className="radio-bullet" />
                <div className="radio-body">
                  <div className="radio-label">
                    {m.label}
                    {danger && <span className="danger-pill">high usage</span>}
                  </div>
                  <div className="radio-hint">{m.hint}</div>
                </div>
              </button>
            );
          })}
        </div>
        {everything && (
          <div className="warning-banner">
            <Icon name="info" size={14} />
            <span>Consumes tokens very fast — scanning every site you visit indiscriminately.</span>
          </div>
        )}
      </MetricCard>

      <div className={`source-group${everything ? ' section-deactivated' : ''}`} aria-hidden={everything}>
        <MetricCard title="Platforms">
          <div>
            {PLATFORMS.map(p => (
              <div key={p.key} className="site-row">
                <div className="site-globe"><Icon name={p.icon} size={14} /></div>
                <div className="site-body">
                  <div className="site-host" style={{ fontFamily: 'inherit' }}>{p.label}</div>
                  <div className="site-meta">{platforms[p.key] ? p.hint : 'paused'}</div>
                </div>
                <Toggle
                  on={platforms[p.key]}
                  onChange={() => setPlatformEnabled(p.key, !platforms[p.key])}
                  label={p.label}
                />
              </div>
            ))}
          </div>
        </MetricCard>
      </div>

      <div className={`source-group${everything ? ' section-deactivated' : ''}`} aria-hidden={everything}>
        <MetricCard
          title={`Sites (${sites.length})`}
          action={<button className="ghost-btn"><Icon name="plus" size={11} /> Add site</button>}
        >
          <div>
            {sites.map((s, i) => (
              <div key={s.host} className="site-row">
                <div className="site-globe"><Icon name="globe" size={13} /></div>
                <div className="site-body">
                  <div className="site-host">{s.host}</div>
                  <div className="site-meta">
                    {s.enabled ? `${s.count} scanned · ${s.ai} AI` : 'paused'}
                  </div>
                </div>
                <Toggle
                  on={s.enabled}
                  onChange={() => toggleSiteAt(i)}
                />
                <button
                  className="icon-btn site-remove"
                  onClick={() => removeSiteAt(i)}
                  title={`Remove ${s.host}`}
                  aria-label={`Remove ${s.host}`}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
          </div>
        </MetricCard>
      </div>
    </div>
  );
}
