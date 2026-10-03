import { useId } from 'react';
import { niceTicks } from './chartUtils';
import './charts.css';

const GUTTER_LEFT = 28; // room for y labels
const PAD_TOP = 8;
const PAD_BOTTOM = 8;

/**
 * Sprint burndown — dashed ideal line + accent actual line over a soft area,
 * with a today marker. `actual` may contain `null` for future days; rendering
 * stops at the last numeric value. `today` is the zero-based day index of "now".
 */
export function BurndownChart({
  total = 41,
  actual = [],
  today,
  days = 14,
  width = 320,
  height = 140,
}) {
  const gradId = useId();
  const drawn = actual.filter((v) => v != null);
  const ticks = niceTicks(Math.max(total, ...drawn, 1), 3);
  const max = ticks[ticks.length - 1];
  const plotW = Math.max(1, width - GUTTER_LEFT);
  const plotH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);
  const xStep = plotW / Math.max(1, days);
  const x = (i) => GUTTER_LEFT + i * xStep;
  const y = (v) => PAD_TOP + plotH - (v / max) * plotH;

  const ideal = Array.from({ length: days + 1 }, (_, i) => total - (total / days) * i);
  const actualPath = drawn.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  const baseY = y(0);
  const areaPath = drawn.length > 0
    ? `${actualPath} L ${x(drawn.length - 1)} ${baseY} L ${x(0)} ${baseY} Z`
    : '';
  const todayIdx = today != null ? today : drawn.length - 1;

  return (
    <svg
      className="chart"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Burndown: ${drawn.length ? drawn[drawn.length - 1] : total} of ${total} points remaining`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="chart-area-stop" stopOpacity="0.16" />
          <stop offset="100%" className="chart-area-stop" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line className="chart-grid" x1={GUTTER_LEFT} y1={y(v)} x2={width} y2={y(v)} />
          <text className="chart-axis" x={GUTTER_LEFT - 8} y={y(v) + 3} textAnchor="end">{v}</text>
        </g>
      ))}
      <path
        className="chart-goal"
        d={ideal.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')}
      />
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
      {actualPath && <path className="chart-line" d={actualPath} />}
      {drawn.length > 0 && todayIdx >= 0 && todayIdx < drawn.length && (
        <>
          <line className="chart-today" x1={x(todayIdx)} y1={PAD_TOP} x2={x(todayIdx)} y2={baseY} />
          <circle className="chart-point" cx={x(todayIdx)} cy={y(drawn[todayIdx])} r="4" />
        </>
      )}
    </svg>
  );
}
