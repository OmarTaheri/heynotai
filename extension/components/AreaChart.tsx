interface Series {
  values: number[];
  color: string;
  opacity?: number;
}

interface Props {
  series: Series[];
  height?: number;
  /** Logical width used for SVG coords; rendered width is always 100% of container. */
  logicalWidth?: number;
}

// Layered area chart — each series drawn as a filled polygon + line.
// SVG scales to the container width while keeping a stable coordinate system.
export function AreaChart({ series, height = 72, logicalWidth = 320 }: Props) {
  const n = series[0]?.values.length ?? 0;
  if (n < 2) return <svg width="100%" height={height} style={{ display: 'block' }} />;
  const allMax = Math.max(1, ...series.flatMap((s) => s.values));

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${logicalWidth} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      {series.map((s, i) => {
        const pts = s.values.map((v, idx) => {
          const x = (idx / (n - 1)) * logicalWidth;
          const y = height - (v / allMax) * (height - 6) - 2;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        const area = `0,${height} ${pts} ${logicalWidth},${height}`;
        return (
          <g key={i}>
            <polygon points={area} fill={s.color} opacity={s.opacity ?? 0.12} />
            <polyline
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}
