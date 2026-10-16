import { niceTicks } from './chartUtils';
import './charts.css';

const GUTTER_LEFT = 28; // room for y labels
const PAD_TOP = 8;
const PAD_BOTTOM = 22; // room for sprint labels
const GAP = 12;

function fitLabel(text, px) {
  const maxChars = Math.max(3, Math.floor(px / 6));
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

/**
 * Committed-vs-completed bar chart for the last N sprints, with an optional
 * rolling-average overlay line (AN-02).
 * `sprints` is `[{ name, committed, completed, current, rollingAverage? }]`.
 * Committed renders as a muted bar; completed sits in front of it in the
 * accent, with the current (or latest active) sprint as the highlighted bar. When
 * any entry carries a numeric `rollingAverage`, a dashed line joins the bar
 * centers.
 */
export function VelocityChart({ sprints = [], width = 320, height = 140 }) {
  if (sprints.length === 0) {
    return <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} />;
  }
  const hasRolling = sprints.some((s) => typeof s.rollingAverage === 'number');
  const ticks = niceTicks(
    Math.max(...sprints.map((s) => Math.max(s.committed, s.completed, s.rollingAverage ?? 0)), 10),
    3,
  );
  const max = ticks[ticks.length - 1];
  const plotW = Math.max(1, width - GUTTER_LEFT);
  const plotH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);
  const slot = plotW / sprints.length;
  const bw = Math.max(4, Math.min(56, slot - GAP));
  const barX = (i) => GUTTER_LEFT + i * slot + (slot - bw) / 2;
  const barCenter = (i) => barX(i) + bw / 2;
  const baseY = PAD_TOP + plotH;
  const yFor = (v) => baseY - (v / max) * plotH;
  // Highlight the current sprint; if it has no completed points yet (or no
  // sprint is flagged current), the latest sprint with progress instead.
  let highlight = sprints.findIndex((s) => s.current);
  if (highlight < 0 || !(sprints[highlight].completed > 0)) {
    highlight = sprints.length - 1;
    while (highlight > 0 && !(sprints[highlight].completed > 0)) highlight -= 1;
  }
  const rollingPath = hasRolling
    ? sprints.map((s, i) => `${i === 0 ? 'M' : 'L'} ${barCenter(i)} ${yFor(s.rollingAverage ?? 0)}`).join(' ')
    : '';

  return (
    <svg
      className="chart"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Velocity: committed vs completed points per sprint"
    >
      {ticks.map((v) => (
        <g key={v}>
          <line className="chart-grid" x1={GUTTER_LEFT} y1={yFor(v)} x2={width} y2={yFor(v)} />
          <text className="chart-axis" x={GUTTER_LEFT - 8} y={yFor(v) + 3} textAnchor="end">{v}</text>
        </g>
      ))}
      {sprints.map((s, i) => {
        const x = barX(i);
        const hCom = Math.max(0, baseY - yFor(s.committed));
        const hP = Math.max(0, baseY - yFor(s.completed));
        return (
          <g key={s.name}>
            <title>{`${s.name}: ${s.completed} of ${s.committed} pt completed`}</title>
            <rect className="chart-bar-muted" x={x} y={baseY - hCom} width={bw} height={hCom} rx="4" />
            <rect
              className={`chart-bar${i === highlight ? ' is-key' : ''}`}
              x={x}
              y={baseY - hP}
              width={bw}
              height={hP}
              rx="4"
            />
            <text className="chart-axis" x={barCenter(i)} y={height - 6} textAnchor="middle">
              {fitLabel(s.name, slot)}
            </text>
          </g>
        );
      })}
      {hasRolling && <path className="chart-goal" d={rollingPath} />}
    </svg>
  );
}
