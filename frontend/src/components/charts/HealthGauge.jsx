import './charts.css';

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
  const band = clamped >= 75 ? 'success' : clamped >= 50 ? 'warning' : 'danger';
  return (
    <svg
      className="chart"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Health score ${clamped} of 100`}
    >
      <circle className="chart-gauge-track" cx={cx} cy={cx} r={r} strokeWidth={stroke} />
      <circle
        className={`chart-gauge-arc is-${band}`}
        cx={cx}
        cy={cx}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text className="chart-gauge-value" x={cx} y={cx + size / 14} textAnchor="middle" fontSize={size / 4.2}>
        {clamped}
      </text>
      <text className="chart-gauge-sub" x={cx} y={cx + size / 4.6} textAnchor="middle">
        of 100
      </text>
    </svg>
  );
}
