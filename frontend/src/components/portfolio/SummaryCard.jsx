import { Card, Skeleton } from '@/components/ui';
import './SummaryCard.css';

// Shared layout for portfolio summary cards. Per-type summaries use this
// component so the portfolio grid stays visually consistent regardless
// of what's inside each card.
export function SummaryCard({ loading, error, children, footer }) {
  if (loading) {
    return (
      <Card className="portfolio-summary">
        <Skeleton height={20} />
        <div style={{ height: 8 }} />
        <Skeleton height={36} />
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="portfolio-summary portfolio-summary--error">
        <p className="muted">Could not load summary.</p>
      </Card>
    );
  }
  return (
    <Card className="portfolio-summary">
      <div className="portfolio-summary__body">{children}</div>
      {footer && <div className="portfolio-summary__footer">{footer}</div>}
    </Card>
  );
}

export function SummaryMetric({ label, value, tone, sublabel }) {
  return (
    <div className="portfolio-summary__metric">
      <div className="portfolio-summary__metric-label">{label}</div>
      <div
        className="portfolio-summary__metric-value"
        style={tone ? { color: `var(--status-${tone})` } : undefined}
      >
        {value}
      </div>
      {sublabel && <div className="muted portfolio-summary__metric-sub">{sublabel}</div>}
    </div>
  );
}

export function SummaryRow({ label, value, tone }) {
  return (
    <div className="portfolio-summary__row">
      <span className="truncate">{label}</span>
      <span
        className="mono"
        style={tone ? { color: `var(--status-${tone})` } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
