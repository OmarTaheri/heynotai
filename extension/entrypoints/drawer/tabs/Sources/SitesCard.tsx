import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Toggle } from '@/components/Toggle';
import type { Site } from '@/lib/types';

export function SitesCard({
  sites,
  addSite,
  toggleSiteAt,
  removeSiteAt,
}: {
  sites: Site[];
  addSite: (host: string) => void;
  toggleSiteAt: (i: number) => void;
  removeSiteAt: (i: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draftHost, setDraftHost] = useState('');

  const submit = () => {
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
                submit();
              } else if (e.key === 'Escape') {
                setAdding(false);
                setDraftHost('');
              }
            }}
            style={{ flex: 1 }}
          />
          <button className="ghost-btn" type="button" onClick={submit}>
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
  );
}
