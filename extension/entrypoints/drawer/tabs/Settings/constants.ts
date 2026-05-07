import type { IconName } from '@/components/Icon';
import type { Language, Mode, Theme } from '@/lib/state';

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'zh', label: '中文' },
  { value: 'ar', label: 'العربية' },
  { value: 'ja', label: '日本語' },
];

export const MODES: { key: Mode; label: string; icon: IconName; desc: string }[] = [
  { key: 'normal', label: 'Normal', icon: 'user', desc: 'Essential features with a calm, uncluttered UI.' },
  { key: 'power',  label: 'Power',  icon: 'bolt', desc: 'Every advanced control, chart, and filter exposed.' },
];

export const THEMES: { key: Theme; label: string; icon: IconName }[] = [
  { key: 'light',  label: 'Light',  icon: 'sun' },
  { key: 'dark',   label: 'Dark',   icon: 'moon' },
  { key: 'system', label: 'System', icon: 'sparkle' },
];
