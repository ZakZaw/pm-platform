import { STATUS_MAP } from './constants';
import './StatusBadge.css';

export function StatusBadge({ status, className = '' }) {
  const entry = STATUS_MAP[status];
  if (!entry) {
    return <span className={['status', className].filter(Boolean).join(' ')}>{status}</span>;
  }
  const { key, label } = entry;
  const classes = ['status', `status-${key}`, className].filter(Boolean).join(' ');
  return <span className={classes}>{label}</span>;
}
