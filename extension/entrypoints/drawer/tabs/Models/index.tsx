import { useEffect, useState } from 'react';
import { isModelLocked, type Plan } from '@heynotai/shared';
import { Icon } from '@/components/Icon';
import { useApp } from '@/lib/state';
import { useAuth } from '@/lib/auth-state';
import {
  fetchModelsCatalog,
  type EngineType,
  type ModelsCatalog,
} from '@/lib/models-api';
import { loadModelSelection, saveModelSelection } from '@/lib/model-selection';
import { AutoModeCard } from './AutoModeCard';
import { EngineList } from './EngineList';
import { AdvancedCard } from './AdvancedCard';
import { TYPES } from './constants';

const NO_SELECTION: Record<EngineType, string> = {
  txt: '', img: '', aud: '', vid: '',
};

export function Models() {
  const { mode, autoModelMode, setAutoModelMode } = useApp();
  const { user } = useAuth();
  const userPlan: Plan = (user?.plan as Plan | undefined) ?? 'check';
  const powerMode = mode === 'power';

  const [catalog, setCatalog] = useState<ModelsCatalog | null>(null);
  const [loadTick, setLoadTick] = useState(0);
  const [selected, setSelected] = useState<Record<EngineType, string>>(NO_SELECTION);
  // Gates both reconciliation and persistence until the stored picks
  // have actually been read. Without it the first render's empty
  // selection races the chrome.storage read: whichever lands second
  // wins, so the user's saved choice was sometimes silently replaced
  // by the API default and written back over itself.
  const [hydrated, setHydrated] = useState(false);

  // 1. Restore the persisted picks so the highlighted row survives a
  //    drawer close/open.
  useEffect(() => {
    let cancelled = false;
    void loadModelSelection().then((stored) => {
      if (cancelled) return;
      setSelected(stored.selected);
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  // 2. Load the live catalog.
  useEffect(() => {
    let cancelled = false;
    setCatalog(null);
    void fetchModelsCatalog().then((c) => {
      if (!cancelled) setCatalog(c);
    });
    return () => { cancelled = true; };
  }, [user?.id, loadTick]);

  // 3. Reconcile stored picks against the catalog: drop any slug the
  //    catalog no longer offers or the user's plan can't reach (the
  //    downgrade case), falling back to the API's plan-aware default.
  useEffect(() => {
    if (!hydrated || !catalog || catalog.error) return;
    setSelected((prev) => {
      let changed = false;
      const next = { ...prev };
      TYPES.forEach((type) => {
        const engine = catalog.engines[type].find((e) => e.id === prev[type]);
        const usable = !!engine && !isModelLocked(userPlan, engine.tier);
        if (!usable && next[type] !== catalog.defaults[type]) {
          next[type] = catalog.defaults[type];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [hydrated, catalog, userPlan]);

  // 4. Mirror the picks (and auto mode) into chrome.storage.local. The
  //    background service worker reads this when it POSTs /scans, which
  //    is what actually makes the picker do something — before this the
  //    selection never left the drawer.
  useEffect(() => {
    if (!hydrated) return;
    void saveModelSelection({ auto: autoModelMode, selected });
  }, [hydrated, autoModelMode, selected]);

  const bannerTitle = 'Pick a checker for each type of content';
  const bannerDesc = autoModelMode
    ? "heynotai is choosing the recommended checker per type. Turn off Auto mode to pick your own."
    : "We'll use these to check for AI. Switch to Power mode in Settings for the technical names.";

  const effective: Record<EngineType, string> = autoModelMode && catalog && !catalog.error
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
