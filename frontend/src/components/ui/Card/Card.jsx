import './Card.css';

export function Card({ title, subtitle, className = '', children }) {
  const classes = ['card', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {title && <h2 className="card__title">{title}</h2>}
      {subtitle && <p className="card__subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}
