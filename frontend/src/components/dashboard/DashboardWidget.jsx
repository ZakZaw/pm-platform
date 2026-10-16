import { Card, Skeleton } from '@/components/ui';
import './DashboardWidget.css';

// Theme-aware palette for stacked-bar / legend segments. Token references
// (not hex) so the swatches track light/dark and the design system — cycle
// through it with `SEGMENT_TOKENS[i % SEGMENT_TOKENS.length]`. Accent leads;
// the rest are the calmer categorical hues.
export const SEGMENT_TOKENS = [
  'var(--accent)',
  'var(--teal)',
  'var(--violet)',
  'var(--amber)',
  'var(--info)',
  'var(--rose)',
  'var(--success)',
  'var(--warning)',
];

// Shared shell for typed-dashboard widgets — common header layout, loading
// + empty states. Keeps each widget component focused on its own data.
// (The old per-card `eyebrow` type label was dropped — the page header
// already names the project type.)
export function DashboardWidget({
  title,
  loading,
  empty,
  emptyText = 'No data yet.',
  action,
  children,
  span = 4,
  testid,
}) {
  return (
    <Card
      data-testid={testid}
      className={`dashboard-widget dashboard-widget-span-${span}`}
    >
      <header className="dashboard-widget-head">
        <h3 className="dashboard-widget-title">{title}</h3>
        {action}
      </header>
      {loading ? (
        <div className="dashboard-widget-body">
          <Skeleton height={80} radius="md" />
        </div>
      ) : empty ? (
        <div className="dashboard-widget-body">
          <p className="dashboard-widget-empty">{emptyText}</p>
        </div>
      ) : (
        <div className="dashboard-widget-body">{children}</div>
      )}
    </Card>
  );
}

/**
 * One big number with a plain label. `tone` (success / warning / danger /
 * info) renders as a coloured dot + text on the sublabel — or on the label
 * when there's no sublabel — so the number itself stays calm.
 */
export function MetricRow({ label, value, sublabel, tone }) {
  const toneClass = tone ? ` dash-tone dash-tone-${tone}` : '';
  return (
    <div className="dashboard-widget-metric">
      <div className="dashboard-widget-metric-value">{value}</div>
      <div className={`dashboard-widget-metric-label${sublabel ? '' : toneClass}`}>{label}</div>
      {sublabel && <div className={`dashboard-widget-metric-sub${toneClass}`}>{sublabel}</div>}
    </div>
  );
}

/** Thin progress bar using the stratos `.bar` vocabulary. */
export function ProgressBar({ pct, tone }) {
  const clamped = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="bar" aria-hidden="true">
      <div className={`bar-fill${tone ? ` bar-fill-${tone}` : ''}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** Label + value list (deal / ticket / run rows). */
export function WidgetRows({ rows }) {
  return (
    <ul className="dashboard-widget-rows">
      {rows.map((r) => (
        <li key={r.key} className="dashboard-widget-row">
          <span className="truncate">{r.label}</span>
          <span className="dashboard-widget-row-meta">{r.meta}</span>
        </li>
      ))}
    </ul>
  );
}

export function StackedBar({ segments, format = (v) => v }) {
  // `segments` is `[{ label, value, color }]`. Renders a horizontal
  // stacked bar with proportional widths and a legend underneath.
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  return (
    <>
      <div className="dashboard-widget-bar">
        {segments.map((s) => (
          <span
            key={s.label}
            className="dashboard-widget-bar-seg"
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
            }}
            title={`${s.label}: ${format(s.value)}`}
          />
        ))}
      </div>
      <ul className="dashboard-widget-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="dashboard-widget-legend-swatch" style={{ background: s.color }} />
            <span className="truncate">{s.label}</span>
            <span className="dashboard-widget-legend-value">{format(s.value)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
