import { X } from 'lucide-react';
import './Chip.css';

const TONE_TO_BADGE = {
  neutral: '',
  info: 'badge-info',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  violet: 'badge-violet',
  purple: 'badge-violet',
  teal: 'badge-teal',
  rose: 'badge-rose',
  accent: 'badge-accent',
};

export function Chip({ tone = 'neutral', onRemove, children, removeLabel }) {
  const toneCls = TONE_TO_BADGE[tone] ?? '';
  const classes = ['chip', toneCls, onRemove ? 'chip-removable' : ''].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      {children}
      {onRemove && (
        <button
          type="button"
          className="chip-remove"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${typeof children === 'string' ? children : 'tag'}`}
        >
          <X size={10} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
