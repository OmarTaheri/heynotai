import { Icon } from '@/components/Icon';
import { MetricCard } from '@/components/MetricCard';
import { Toggle } from '@/components/Toggle';
import type { Platforms, PlatformKey, SurfaceKey } from '@/lib/state';
import { PLATFORMS } from './constants';

export function PlatformsCard({
  platforms,
  setPlatformEnabled,
  setPlatformSurface,
}: {
  platforms: Platforms;
  setPlatformEnabled: (k: PlatformKey, v: boolean) => void;
  setPlatformSurface: <P extends PlatformKey>(
    platform: P,
    surface: SurfaceKey<P>,
    enabled: boolean,
  ) => void;
}) {
  return (
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
  );
}
