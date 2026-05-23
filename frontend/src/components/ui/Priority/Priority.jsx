/* Priority styles live in stratos.css (.priority, .priority-flag, .priority-{level}). */

const LEVEL_KEY = {
  Urgent: 'urgent',
  High: 'high',
  Medium: 'medium',
  Med: 'medium',
  Low: 'low',
  urgent: 'urgent',
  high: 'high',
  med: 'medium',
  medium: 'medium',
  low: 'low',
};

const LEVEL_LABEL = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function Priority({ level, title, showLabel = false, className = '' }) {
  const key = LEVEL_KEY[level] ?? 'low';
  const label = title ?? `${LEVEL_LABEL[key]} priority`;
  const classes = ['priority', `priority-${key}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes} title={label} aria-label={label}>
      <span className="priority-flag" />
      {showLabel && <span>{LEVEL_LABEL[key]}</span>}
    </span>
  );
}
