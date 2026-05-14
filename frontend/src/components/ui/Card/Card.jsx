import './Card.css';

export function Card({ variant = 'default', title, subtitle, className = '', children }) {
  const variantClass = variant === 'default' ? 'card' : `card-${variant}`;
  const classes = [variantClass, className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {title && <h2 className="card__title">{title}</h2>}
      {subtitle && <p className="card__subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}
