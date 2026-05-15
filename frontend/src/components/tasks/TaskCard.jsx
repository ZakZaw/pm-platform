import { StatusBadge } from '@/components/ui';
import './TaskCard.css';

const PRIORITY_TONE = {
  Urgent: 'prio-urgent',
  High: 'prio-high',
  Medium: 'prio-med',
  Low: 'prio-low',
};

export function TaskCard({ task, onOpen, compact = false }) {
  return (
    <button
      type="button"
      className={['task-card', compact ? 'is-compact' : ''].filter(Boolean).join(' ')}
      onClick={() => onOpen?.(task)}
    >
      <div className="task-card__row">
        <span className={['task-card__prio', PRIORITY_TONE[task.priority]].join(' ')} aria-label={task.priority} />
        <span className="task-card__title">{task.title}</span>
      </div>
      <div className="task-card__row task-card__row--meta">
        <StatusBadge status={task.status} />
      </div>
    </button>
  );
}
