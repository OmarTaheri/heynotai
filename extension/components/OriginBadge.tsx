import { Icon, type IconName } from './Icon';
import type { Origin } from '@/lib/library';

const ICON: Record<Origin, IconName> = {
  ext: 'puzzle',
  up: 'upload',
  url: 'link',
  mon: 'activity',
  paste: 'paperclip',
};

export function OriginBadge({ origin }: { origin: Origin }) {
  return (
    <span className={`origin-badge ob-${origin}`} aria-hidden>
      <Icon name={ICON[origin]} size={11} />
    </span>
  );
}
