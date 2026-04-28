interface Props {
  human: number;
  mixed: number;
  ai: number;
  size?: number;
  strokeWidth?: number;
}

// Three-segment donut. Uses stroke-dasharray offsets per arc.
export function Donut({ human, mixed, ai, size = 96, strokeWidth = 14 }: Props) {
  const total = human + mixed + ai || 1;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  const segs = [
    { color: 'var(--human)', value: human },
    { color: 'var(--mixed)', value: mixed },
    { color: 'var(--ai)',    value: ai },
  ];

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--surface-sunken)"
        strokeWidth={strokeWidth}
      />
      {segs.map((s, i) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}
