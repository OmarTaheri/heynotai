interface Props {
  buckets: number[];
  height?: number;
  color?: string;
  /** Logical width for SVG coords; rendered width is always 100% of container. */
  logicalWidth?: number;
}

export function Histogram({
  buckets,
  height = 64,
  color = 'var(--info)',
  logicalWidth = 320,
}: Props) {
  const max = Math.max(1, ...buckets);
  const gap = 3;
  const barW = (logicalWidth - gap * (buckets.length - 1)) / buckets.length;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${logicalWidth} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      {buckets.map((v, i) => {
        const barH = Math.max(1, (v / max) * (height - 4));
        const x = i * (barW + gap);
        const y = height - barH;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={2}
            fill={color}
            opacity={0.3 + (v / max) * 0.7}
          />
        );
      })}
    </svg>
  );
}
