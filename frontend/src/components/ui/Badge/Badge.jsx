import './Badge.css';

export function Badge({ tone = 'neutral', dot = false, className = '', children }) {
  const classes = ['badge', `badge-${tone}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      {dot && <span className="dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
