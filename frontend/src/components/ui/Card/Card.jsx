import './Card.css';

export function Card({ variant = 'default', title, subtitle, className = '', children }) {
  const base = variant === 'ai' ? 'card-ai' : 'card';
  const elevated = variant === 'elevated' ? 'card-elevated' : '';
  const classes = [base, 'card-pad', elevated, className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {title && <h2 className="card__title">{title}</h2>}
      {subtitle && <p className="card__subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}
