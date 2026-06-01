import { Card, Skeleton } from '@/components/ui';
import './DashboardWidget.css';

// Theme-aware palette for stacked-bar / legend segments. Token references
// (not hex) so the swatches track light/dark and the design system — cycle
// through it with `SEGMENT_TOKENS[i % SEGMENT_TOKENS.length]`.
export const SEGMENT_TOKENS = [
  'var(--accent)',
  'var(--info)',
  'var(--violet)',
  'var(--teal)',
  'var(--success)',
  'var(--amber)',
  'var(--rose)',
  'var(--warning)',
];

// Shared shell for typed-dashboard widgets — common header layout,
// optional eyebrow label, loading + empty states. Keeps each widget
// component focused on its own data fetch.
export function DashboardWidget({
  title,
  eyebrow,
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
      className={`dashboard-widget dashboard-widget--span-${span}`}
    >
      <header className="dashboard-widget__head">
        <div className="dashboard-widget__heading">
          {eyebrow && <span className="subsection-eyebrow">{eyebrow}</span>}
          <h3 className="dashboard-widget__title">{title}</h3>
        </div>
        {action}
      </header>
      {loading ? (
        <div className="dashboard-widget__body">
          <Skeleton height={80} radius="md" />
        </div>
      ) : empty ? (
        <div className="dashboard-widget__body">
          <p className="dashboard-widget__empty">{emptyText}</p>
        </div>
      ) : (
        <div className="dashboard-widget__body">{children}</div>
      )}
    </Card>
  );
}

export function MetricRow({ label, value, sublabel, accent }) {
  return (
    <div className="dashboard-widget__metric">
      <div className="dashboard-widget__metric-label">{label}</div>
      <div
        className="dashboard-widget__metric-value"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sublabel && <div className="muted dashboard-widget__metric-sub">{sublabel}</div>}
    </div>
  );
}

export function StackedBar({ segments }) {
  // `segments` is `[{ label, value, color }]`. Renders a horizontal
  // stacked bar with proportional widths and a legend underneath.
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  return (
    <>
      <div className="dashboard-widget__bar">
        {segments.map((s) => (
          <span
            key={s.label}
            className="dashboard-widget__bar-seg"
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
            }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <ul className="dashboard-widget__legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="dashboard-widget__legend-swatch" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="mono dim">{s.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
