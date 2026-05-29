/**
 * Committed-vs-completed bar chart for the last N sprints, with an optional
 * rolling-average overlay line (AN-02).
 * `sprints` is `[{ name, committed, completed, current, rollingAverage? }]`.
 * When any entry carries a numeric `rollingAverage`, a line is drawn across
 * the bar centers.
 */
export function VelocityChart({ sprints = [], width = 320, height = 140 }) {
  if (sprints.length === 0) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} />;
  }
  const hasRolling = sprints.some((s) => typeof s.rollingAverage === 'number');
  const max = Math.max(
    ...sprints.map((s) => Math.max(s.committed, s.completed, s.rollingAverage ?? 0)),
    10,
  );
  const bw = (width - 22) / sprints.length - 6;
  const barCenter = (i) => 22 + i * (bw + 6) + bw / 2;
  const yFor = (v) => height - (v / max) * (height - 20);
  const rollingPath = hasRolling
    ? sprints
        .map((s, i) => `${i === 0 ? 'M' : 'L'} ${barCenter(i)} ${yFor(s.rollingAverage ?? 0)}`)
        .join(' ')
    : '';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[10, 20, 30, 40, 50].filter((v) => v <= max).map((v) => (
        <g key={v}>
          <line
            x1="20"
            y1={height - (v / max) * (height - 20)}
            x2={width}
            y2={height - (v / max) * (height - 20)}
            stroke="var(--border-subtle)"
            strokeDasharray="2 3"
          />
          <text
            x="0"
            y={height - (v / max) * (height - 20) - 2}
            fontSize="9"
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
          >
            {v}
          </text>
        </g>
      ))}
      {sprints.map((s, i) => {
        const x = 22 + i * (bw + 6);
        const hCom = (s.committed / max) * (height - 20);
        const hP = (s.completed / max) * (height - 20);
        return (
          <g key={s.name}>
            <rect
              x={x}
              y={height - hCom}
              width={bw}
              height={hCom}
              fill={s.current ? 'rgba(91,106,240,0.20)' : 'var(--surface-hover)'}
              rx="2"
            />
            <rect
              x={x}
              y={height - hP}
              width={bw}
              height={hP}
              fill="var(--accent)"
              opacity={s.current ? 1 : 0.7}
              rx="2"
            />
            <text
              x={x + bw / 2}
              y={height - 4}
              fontSize="9"
              fill="var(--text-muted)"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
            >
              {s.name}
            </text>
          </g>
        );
      })}
      {hasRolling && (
        <>
          <path
            d={rollingPath}
            stroke="var(--ai-2)"
            strokeWidth="1.75"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {sprints.map((s, i) => (
            <circle
              key={`r-${s.name}`}
              cx={barCenter(i)}
              cy={yFor(s.rollingAverage ?? 0)}
              r="2.5"
              fill="var(--ai-2)"
            />
          ))}
        </>
      )}
    </svg>
  );
}
