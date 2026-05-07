import { useApp } from '@/lib/state';
import { ScanModeCard } from './ScanModeCard';
import { PlatformsCard } from './PlatformsCard';
import { SitesCard } from './SitesCard';

export function Sources() {
  const {
    scanMode, setScanMode,
    sites, addSite, toggleSiteAt, removeSiteAt,
    platforms, setPlatformEnabled, setPlatformSurface,
  } = useApp();

  const everything = scanMode === 'everything';

  return (
    <div className="panel">
      <ScanModeCard scanMode={scanMode} setScanMode={setScanMode} />

      <div className={`source-group${everything ? ' section-deactivated' : ''}`} aria-hidden={everything}>
        <PlatformsCard
          platforms={platforms}
          setPlatformEnabled={setPlatformEnabled}
          setPlatformSurface={setPlatformSurface}
        />
      </div>

      <div className={`source-group${everything ? ' section-deactivated' : ''}`} aria-hidden={everything}>
        <SitesCard
          sites={sites}
          addSite={addSite}
          toggleSiteAt={toggleSiteAt}
          removeSiteAt={removeSiteAt}
        />
      </div>
    </div>
  );
}
