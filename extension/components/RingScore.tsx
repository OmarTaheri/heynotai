import type { Verdict } from '@/lib/types';

interface Props { score: number; verdict: Verdict; size?: number; }

const COLOR_VAR: Record<Verdict, string> = {
  ai: 'var(--ai)',
  human: 'var(--human)',
  mixed: 'var(--mixed)',
};

export function RingScore({ score, verdict, size = 80 }: Props) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = c * pct;

  return (
    <div className="ring">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="var(--line-strong)" strokeWidth={5} strokeDasharray="3 3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={COLOR_VAR[verdict]} strokeWidth={5}
                strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round" />
      </svg>
      <div className="ring-label">
        <span>{score}<span className="pct">%</span></span>
      </div>
    </div>
  );
}
