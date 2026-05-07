import { Icon, type IconName } from '@/components/Icon';
import {
  type Range,
  type Scope,
  SCOPE_LABELS,
} from '@/lib/stats-data';

export const SCOPE_META: { value: Scope; label: string; iconName: IconName }[] = [
  { value: 'all',       label: SCOPE_LABELS.all,       iconName: 'globe' },
  { value: 'websites',  label: SCOPE_LABELS.websites,  iconName: 'layers' },
  { value: 'social',    label: SCOPE_LABELS.social,    iconName: 'user' },
  { value: 'facebook',  label: SCOPE_LABELS.facebook,  iconName: 'facebook' },
  { value: 'youtube',   label: SCOPE_LABELS.youtube,   iconName: 'youtube' },
  { value: 'instagram', label: SCOPE_LABELS.instagram, iconName: 'instagram' },
];

export const SCOPE_OPTIONS = SCOPE_META.map(o => ({
  value: o.value,
  label: o.label,
  icon: <Icon name={o.iconName} size={12} />,
}));

export const RANGES: Range[] = ['today', '7d', '30d', 'all'];

export function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toString();
}

export function verdictOf(pct: number): 'ai' | 'mixed' | 'human' {
  return pct >= 50 ? 'ai' : pct >= 25 ? 'mixed' : 'human';
}

export function colorVarOf(v: 'ai' | 'mixed' | 'human') {
  return v === 'ai' ? 'var(--ai)' : v === 'human' ? 'var(--human)' : 'var(--mixed)';
}

export function platformToScope(p: string): Scope | null {
  if (p === 'facebook' || p === 'youtube' || p === 'instagram') return p;
  return null;
}

export function platformIcon(key: 'facebook' | 'youtube' | 'instagram' | 'other'): IconName {
  if (key === 'other') return 'globe';
  return key;
}

export function exportCsv(rows: string[][]) {
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `heynotai-stats-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
