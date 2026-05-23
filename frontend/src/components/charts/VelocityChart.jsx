/**
 * Committed-vs-completed bar chart for the last N sprints.
 * `sprints` is `[{ name, committed, completed, current }]`.
 */
export function VelocityChart({ sprints = [], width = 320, height = 140 }) {
  if (sprints.length === 0) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} />;
  }
  const max = Math.max(...sprints.map((s) => Math.max(s.committed, s.completed)), 10);
  const bw = (width - 22) / sprints.length - 6;
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
    </svg>
  );
}
