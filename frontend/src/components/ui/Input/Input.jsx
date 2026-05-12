import { useId } from 'react';
import './Input.css';

export function Input({ label, error, id, className = '', ...rest }) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const classes = ['input', error ? 'input--error' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="input-group">
      {label && (
        <label className="input-group__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input id={inputId} className={classes} {...rest} />
      {error && <span className="input-group__error">{error}</span>}
    </div>
  );
}
