import { Icon, type IconName } from './Icon';
import type { ScanType } from '@/lib/scans-api';

const ICON: Record<ScanType, IconName> = {
  txt: 'text',
  img: 'image',
  aud: 'audio',
  vid: 'video',
  web: 'globe',
  soc: 'users',
  'fb-vid': 'facebook',
  'fb-reel': 'facebook',
  'fb-post': 'facebook',
  'ig-reel': 'instagram',
  'ig-post-img': 'instagram',
  'ig-post-vid': 'instagram',
  'yt-vid': 'youtube',
  'yt-reel': 'youtube',
};

/** Small square chip that signals what kind of content a row represents.
 *  Mirrors the frontend library's TypeChip — base media types use the
 *  tinted verdict palette already in tokens.css, platform variants use
 *  full brand color so the platform reads instantly. */
export function TypeChip({ type }: { type: ScanType }) {
  return (
    <span className={`type-chip tc-${type}`} aria-hidden>
      <Icon name={ICON[type] ?? 'text'} size={14} />
    </span>
  );
}
