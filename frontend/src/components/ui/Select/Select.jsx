import { useId } from 'react';
import './Select.css';

export function Select({ label, error, help, id, className = '', options, children, ...rest }) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const classes = ['select', error ? 'is-error' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="input-group">
      {label && (
        <label className="input-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <select id={inputId} className={classes} {...rest}>
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error && <span className="input-help is-error">{error}</span>}
      {!error && help && <span className="input-help">{help}</span>}
    </div>
  );
}
