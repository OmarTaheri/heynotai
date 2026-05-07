import { useEffect, useState } from 'react';
import { type Plan } from '@heynotai/shared';
import { Icon } from '@/components/Icon';
import { useApp } from '@/lib/state';
import { useAuth } from '@/lib/auth-state';
import {
  fetchModelsCatalog,
  type EngineType,
  type ModelsCatalog,
} from '@/lib/models-api';
import { AutoModeCard } from './AutoModeCard';
import { EngineList } from './EngineList';
import { AdvancedCard } from './AdvancedCard';
import { TYPES } from './constants';

export function Models() {
  const { mode, autoModelMode, setAutoModelMode } = useApp();
  const { user } = useAuth();
  const userPlan: Plan = (user?.plan as Plan | undefined) ?? 'check';
  const powerMode = mode === 'power';

  const [catalog, setCatalog] = useState<ModelsCatalog | null>(null);
  const [loadTick, setLoadTick] = useState(0);
  const [selected, setSelected] = useState<Record<EngineType, string>>({
    txt: '', img: '', aud: '', vid: '',
  });

  useEffect(() => {
    let cancelled = false;
    setCatalog(null);
    void fetchModelsCatalog().then((c) => {
      if (cancelled) return;
      setCatalog(c);
      setSelected((prev) => ({
        txt: prev.txt || c.defaults.txt,
        img: prev.img || c.defaults.img,
        aud: prev.aud || c.defaults.aud,
        vid: prev.vid || c.defaults.vid,
      }));
    });
    return () => { cancelled = true; };
  }, [user?.id, loadTick]);

  const bannerTitle = 'Pick a checker for each type of content';
  const bannerDesc = autoModelMode
    ? "heynotai is choosing the recommended checker per type. Turn off Auto mode to pick your own."
    : "We'll use these to check for AI. Switch to Power mode in Settings for the technical names.";

  const effective: Record<EngineType, string> = autoModelMode && catalog
    ? catalog.defaults
    : selected;

  return (
    <div className={`panel${autoModelMode ? ' auto-active' : ''}`}>
      <AutoModeCard autoModelMode={autoModelMode} setAutoModelMode={setAutoModelMode} />

      <div className="info-banner">
        <Icon name="sparkle" size={15} />
        <div>
          <div className="b-title">{bannerTitle}</div>
          <div className="b-desc">{bannerDesc}</div>
        </div>
      </div>

      {TYPES.map((type) => (
        <EngineList
          key={type}
          type={type}
          catalog={catalog}
          selectedId={effective[type]}
          autoModelMode={autoModelMode}
          userPlan={userPlan}
          onSelect={(id) => setSelected((s) => ({ ...s, [type]: id }))}
          onRetry={() => setLoadTick((n) => n + 1)}
        />
      ))}

      {powerMode && <AdvancedCard />}
    </div>
  );
}
