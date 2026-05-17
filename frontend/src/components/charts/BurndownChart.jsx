/**
 * Sprint burndown — ideal line + actual area + today marker.
 * `actual` may contain `null` for future days; rendering stops at the
 * last numeric value. `today` is the zero-based day index of "now".
 */
export function BurndownChart({
  total = 41,
  actual = [],
  today,
  days = 14,
  width = 320,
  height = 140,
}) {
  const xStep = width / days;
  const max = Math.max(total, ...actual.filter((v) => v != null), 1);
  const y = (v) => height - (v / max) * (height - 20) - 10;

  const ideal = Array.from({ length: days + 1 }, (_, i) => total - (total / days) * i);
  const drawn = actual.filter((v) => v != null);
  const actualPath = drawn
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * xStep} ${y(v)}`)
    .join(' ');
  const areaPath = drawn.length > 0
    ? `${actualPath} L ${(drawn.length - 1) * xStep} ${height} L 0 ${height} Z`
    : '';
  const todayIdx = today != null ? today : drawn.length - 1;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="bd-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[10, 20, 30, 40].filter((v) => v <= max).map((v) => (
        <g key={v}>
          <line x1="0" y1={y(v)} x2={width} y2={y(v)} stroke="var(--border-subtle)" strokeDasharray="2 3" />
          <text
            x="2"
            y={y(v) - 2}
            fontSize="9"
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
          >
            {v}
          </text>
        </g>
      ))}
      <path
        d={ideal.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * xStep} ${y(v)}`).join(' ')}
        stroke="var(--border-strong)"
        strokeWidth="1"
        strokeDasharray="3 4"
        fill="none"
      />
      {areaPath && <path d={areaPath} fill="url(#bd-fill)" />}
      {actualPath && (
        <path
          d={actualPath}
          stroke="var(--accent-primary)"
          strokeWidth="1.75"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {drawn.length > 0 && todayIdx >= 0 && todayIdx < drawn.length && (
        <>
          <circle cx={todayIdx * xStep} cy={y(drawn[todayIdx])} r="3" fill="var(--accent-primary)" />
          <line
            x1={todayIdx * xStep}
            y1={0}
            x2={todayIdx * xStep}
            y2={height}
            stroke="var(--accent-primary)"
            strokeOpacity="0.3"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        </>
      )}
    </svg>
  );
}
