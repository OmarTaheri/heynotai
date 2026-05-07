import { useState } from 'react';
import { MetricCard } from '@/components/MetricCard';
import { Row } from '@/components/Row';
import { Toggle } from '@/components/Toggle';
import type { PrefKey } from './constants';

export function AdvancedCard() {
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    cloud: true, cache: true, share: false,
  });
  return (
    <MetricCard title="Advanced">
      <div>
        <Row label="Cloud scanning" value={
          <Toggle on={prefs.cloud} onChange={() => setPrefs(p => ({ ...p, cloud: !p.cloud }))} label="Cloud scanning" />
        } />
        <Row label="Cache results" value={
          <Toggle on={prefs.cache} onChange={() => setPrefs(p => ({ ...p, cache: !p.cache }))} label="Cache results" />
        } />
        <Row label="Share anonymised signals" value={
          <Toggle on={prefs.share} onChange={() => setPrefs(p => ({ ...p, share: !p.share }))} label="Share anonymised signals" />
        } />
      </div>
    </MetricCard>
  );
}
