import { useId } from 'react';
import './Input.css';

export function Input({ label, error, help, id, className = '', ...rest }) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const classes = ['input', error ? 'is-error' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="input-group">
      {label && (
        <label className="input-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input id={inputId} className={classes} {...rest} />
      {error && <span className="input-help is-error">{error}</span>}
      {!error && help && <span className="input-help">{help}</span>}
    </div>
  );
}
