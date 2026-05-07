import type { Plan } from '@heynotai/shared';
import type { EngineType } from '@/lib/models-api';

export type PrefKey = 'cloud' | 'cache' | 'share';

export const TYPES: EngineType[] = ['txt', 'img', 'aud', 'vid'];

export const TYPE_LABEL: Record<EngineType, string> = {
  txt: 'Text detection',
  img: 'Image detection',
  aud: 'Audio detection',
  vid: 'Video detection',
};

export const TYPE_ICON: Record<EngineType, 'text' | 'image' | 'audio' | 'video'> = {
  txt: 'text',
  img: 'image',
  aud: 'audio',
  vid: 'video',
};

export const TIER_LABEL: Record<Plan, string> = {
  check: 'FREE',
  verify: 'VERIFY',
  certify: 'CERTIFY',
  team: 'TEAM',
};

/* Mailto for the team-tier "Contact sales" CTA. Mirrors
 * `TEAM_SALES_MAILTO` in `frontend/lib/plans-data.ts`. */
export const TEAM_SALES_MAILTO = 'mailto:sales@heynotai.io?subject=Team%20plan';
