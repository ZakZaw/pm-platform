import './Skeleton.css';

/**
 * Pulsing placeholder for content that hasn't loaded yet. Two call shapes:
 *
 *   <Skeleton width={120} height={14} />           // single bar
 *   <Skeleton rows={4} />                          // text block (mixed widths)
 *
 * Use these instead of "Loading…" text on any page that does a network
 * fetch on mount. Calm states > spinner soup.
 */
export function Skeleton({
  width,
  height = 12,
  radius = 'sm',
  rows = 0,
  variant = 'bar',
  className = '',
  style,
}) {
  if (rows > 0) {
    return (
      <div className={['skeleton-stack', className].filter(Boolean).join(' ')} aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <span
            key={i}
            className={['skeleton', `skeleton--r-${radius}`].join(' ')}
            style={{ height, width: rowWidth(i, rows) }}
          />
        ))}
      </div>
    );
  }
  return (
    <span
      className={['skeleton', `skeleton--r-${radius}`, `skeleton--${variant}`, className].filter(Boolean).join(' ')}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

function rowWidth(i, total) {
  // Vary row widths so the placeholder doesn't look like a flat bar chart.
  if (i === total - 1) return '55%';
  if (i % 3 === 0) return '92%';
  if (i % 3 === 1) return '78%';
  return '85%';
}
