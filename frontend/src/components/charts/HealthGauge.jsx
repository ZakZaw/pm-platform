/**
 * Composite project health gauge (0–100). Color band reflects:
 *   ≥ 75 → success · ≥ 50 → warning · else danger.
 */
export function HealthGauge({ score = 0, size = 160, stroke = 10 }) {
  const r = (size / 2) - stroke * 1.2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - clamped / 100);
  const color =
    clamped >= 75 ? 'var(--success)' : clamped >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Health score ${clamped} of 100`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-hover)" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text
        x={cx}
        y={cx - 2}
        textAnchor="middle"
        fontSize={size / 4.7}
        fontWeight="600"
        fill="var(--text)"
        fontFamily="var(--font-sans)"
      >
        {clamped}
      </text>
      <text
        x={cx}
        y={cx + size / 8}
        textAnchor="middle"
        fontSize="11"
        fill="var(--text-muted)"
        fontFamily="var(--font-mono)"
      >
        / 100
      </text>
    </svg>
  );
}
