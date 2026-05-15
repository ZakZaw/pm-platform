import { Badge } from '../Badge/Badge';
import { STATUS_MAP } from './constants';
import './StatusBadge.css';

export function StatusBadge({ status, className = '' }) {
  const entry = STATUS_MAP[status];
  if (!entry) {
    return <Badge tone="neutral" className={className}>{status}</Badge>;
  }
  const { tone, Icon, label } = entry;
  return (
    <Badge tone={tone} className={['status-badge', className].filter(Boolean).join(' ')}>
      <Icon size={12} aria-hidden="true" />
      <span>{label}</span>
    </Badge>
  );
}
