/**
 * Compact line chart used in sprint banners and KPI tiles.
 * `points` is an ordered series; the last point is highlighted with a dot.
 * `ideal` draws the dashed reference line from top-left to bottom-right.
 */
export function Sparkline({
  points = [],
  width = 140,
  height = 28,
  ideal = false,
  stroke = 'var(--accent-primary)',
  className = '',
}) {
  if (!points || points.length < 2) {
    return <svg className={['spark', className].filter(Boolean).join(' ')} width={width} height={height} />;
  }
  const max = Math.max(...points, 1);
  const step = width / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${height - (p / max) * height}`)
    .join(' ');
  const lastX = (points.length - 1) * step;
  const lastY = height - (points[points.length - 1] / max) * height;
  return (
    <svg
      className={['spark', className].filter(Boolean).join(' ')}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {ideal && (
        <line
          x1="0"
          y1="2"
          x2={width}
          y2={height - 2}
          stroke="var(--border-strong)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      )}
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={stroke} />
    </svg>
  );
}
