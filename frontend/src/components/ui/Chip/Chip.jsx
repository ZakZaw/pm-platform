import { X } from 'lucide-react';
import './Chip.css';

export function Chip({ tone = 'neutral', onRemove, children, removeLabel }) {
  const classes = ['badge', `badge-${tone}`, 'chip'].join(' ');
  return (
    <span className={classes}>
      {children}
      {onRemove && (
        <button
          type="button"
          className="chip__remove"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${typeof children === 'string' ? children : 'tag'}`}
        >
          <X size={10} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
