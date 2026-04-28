import type { Verdict } from '@/lib/types';

const COLOR_VAR: Record<Verdict, string> = {
  ai: 'var(--ai)',
  human: 'var(--human)',
  mixed: 'var(--mixed)',
};

export function MiniSpark({
  data,
  verdict,
  width = 120,
  height = 32,
}: {
  data: number[];
  verdict: Verdict;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * width;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = `0,${height} ${pts} ${width},${height}`;
  const color = COLOR_VAR[verdict];
  return (
    <svg className="spark" width={width} height={height}>
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
                strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
