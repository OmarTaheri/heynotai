import type { IconName } from '@/components/Icon';
import type { ScanMode, PlatformKey, SurfaceKey } from '@/lib/state';

export const MODES: { key: ScanMode; label: string; hint: string }[] = [
  { key: 'allowlist',  label: 'Allowed platforms and websites', hint: 'scan only on enabled platforms and sites' },
  { key: 'manual',     label: 'Manual',                         hint: 'only when you click the extension' },
  { key: 'everything', label: 'Everything',                     hint: 'scan every site you visit — no allow-list' },
];

export type PlatformConfig<P extends PlatformKey> = {
  key: P;
  label: string;
  icon: IconName;
  surfaces: { key: SurfaceKey<P>; label: string }[];
};

export const PLATFORMS: [
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
