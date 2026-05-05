import { useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Toggle } from '@/components/Toggle';
import {
  useApp,
  type ScanMode,
  type PlatformKey,
  type SurfaceKey,
} from '@/lib/state';

const MODES: { key: ScanMode; label: string; hint: string }[] = [
  { key: 'allowlist',  label: 'Allowed platforms and websites', hint: 'scan only on enabled platforms and sites' },
  { key: 'manual',     label: 'Manual',                         hint: 'only when you click the extension' },
  { key: 'everything', label: 'Everything',                     hint: 'scan every site you visit — no allow-list' },
];

type PlatformConfig<P extends PlatformKey> = {
  key: P;
  label: string;
  icon: IconName;
  surfaces: { key: SurfaceKey<P>; label: string }[];
};

const PLATFORMS: [
  PlatformConfig<'youtube'>,
  PlatformConfig<'instagram'>,
  PlatformConfig<'facebook'>,
] = [
  {
    key: 'youtube',
    label: 'YouTube',
    icon: 'youtube',
    surfaces: [
      { key: 'videos', label: 'Videos' },
      { key: 'reels',  label: 'Reels'  },
    ],
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: 'instagram',
    surfaces: [
      { key: 'posts', label: 'Posts' },
      { key: 'reels', label: 'Reels' },
    ],
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: 'facebook',
    surfaces: [
      { key: 'posts', label: 'Posts' },
      { key: 'reels', label: 'Reels' },
    ],
  },
];

export function Sources() {
  const {
    scanMode, setScanMode,
    sites, addSite, toggleSiteAt, removeSiteAt,
    platforms, setPlatformEnabled, setPlatformSurface,
  } = useApp();

  const [adding, setAdding] = useState(false);
  const [draftHost, setDraftHost] = useState('');

  const everything = scanMode === 'everything';

  const submitAddSite = () => {
    const clean = draftHost
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '');
    if (!clean) return;
    addSite(clean);
    setDraftHost('');
    setAdding(false);
  };

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
            {PLATFORMS.map(p => {
              const cfg = platforms[p.key];
              const masterOn = cfg.enabled;
              const surfaceCount = p.surfaces.length;
              const onCount = p.surfaces.filter(
                s => (cfg.surfaces as Record<string, boolean>)[s.key],
              ).length;
              const meta = !masterOn
                ? 'paused'
                : onCount === surfaceCount
                  ? `scanning ${p.surfaces.map(s => s.label.toLowerCase()).join(' & ')}`
                  : `${onCount}/${surfaceCount} surfaces on`;
              return (
                <div key={p.key}>
                  <div className="site-row">
                    <div className="site-globe"><Icon name={p.icon} size={14} /></div>
                    <div className="site-body">
                      <div className="site-host" style={{ fontFamily: 'inherit' }}>{p.label}</div>
                      <div className="site-meta">{meta}</div>
                    </div>
                    <Toggle
                      on={masterOn}
                      onChange={() => setPlatformEnabled(p.key, !masterOn)}
                      label={p.label}
                    />
                  </div>
                  {p.surfaces.map(s => {
                    const surfaces = cfg.surfaces as Record<string, boolean>;
                    const surfaceOn = surfaces[s.key] === true;
                    return (
                      <div
                        key={s.key}
                        className={`site-row subrow${masterOn ? '' : ' disabled'}`}
                        title={masterOn ? undefined : `Enable ${p.label} to configure`}
                      >
                        <div className="site-body">
                          <div className="site-host">{s.label}</div>
                          <div className="site-meta">
                            {surfaceOn ? 'enabled' : 'paused'}
                          </div>
                        </div>
                        <Toggle
                          on={surfaceOn}
                          onChange={() =>
                            setPlatformSurface(
                              p.key,
                              s.key as SurfaceKey<typeof p.key>,
                              !surfaceOn,
                            )
                          }
                          label={`${p.label} ${s.label}`}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </MetricCard>
      </div>

      <div className={`source-group${everything ? ' section-deactivated' : ''}`} aria-hidden={everything}>
        <MetricCard
          title={`Sites (${sites.length})`}
          action={
            <button
              className="ghost-btn"
              onClick={() => setAdding(v => !v)}
              type="button"
            >
              <Icon name="plus" size={11} /> Add site
            </button>
          }
        >
          {adding && (
            <div className="site-row" style={{ gap: 8 }}>
              <div className="site-globe"><Icon name="globe" size={13} /></div>
              <input
                type="text"
                className="signin-input"
                placeholder="example.com"
                value={draftHost}
                autoFocus
                onChange={e => setDraftHost(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitAddSite();
                  } else if (e.key === 'Escape') {
                    setAdding(false);
                    setDraftHost('');
                  }
                }}
                style={{ flex: 1 }}
              />
              <button className="ghost-btn" type="button" onClick={submitAddSite}>
                Add
              </button>
            </div>
          )}
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
