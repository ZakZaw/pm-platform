const LEVEL_CLASS = {
  Urgent: 'prio-urgent',
  High: 'prio-high',
  Medium: 'prio-med',
  Med: 'prio-med',
  Low: 'prio-low',
  urgent: 'prio-urgent',
  high: 'prio-high',
  med: 'prio-med',
  medium: 'prio-med',
  low: 'prio-low',
};

const LEVEL_LABEL = {
  Urgent: 'Urgent',
  High: 'High',
  Medium: 'Medium',
  Low: 'Low',
};

export function Priority({ level, title, className = '' }) {
  const cls = LEVEL_CLASS[level] ?? 'prio-low';
  const label = title ?? `${LEVEL_LABEL[level] ?? level} priority`;
  const classes = ['prio', cls, className].filter(Boolean).join(' ');
  return (
    <span className={classes} title={label} aria-label={label}>
      <span />
      <span />
      <span />
    </span>
  );
}
