import { Avatar, StatusBadge } from '@/components/ui';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useParams } from 'react-router-dom';
import './TaskCard.css';

const PRIORITY_TONE = {
  Urgent: 'prio-urgent',
  High: 'prio-high',
  Medium: 'prio-med',
  Low: 'prio-low',
};

export function TaskCard({ task, onOpen, compact = false }) {
  const { slug: orgSlug } = useParams();
  const { members } = useOrgMembers(orgSlug);
  const assignee = task.assigneeId ? members.find((m) => m.userId === task.assigneeId) : null;

  return (
    <button
      type="button"
      className={['task-card', compact ? 'is-compact' : ''].filter(Boolean).join(' ')}
      onClick={() => onOpen?.(task)}
    >
      <div className="task-card__row">
        <span className={['task-card__prio', PRIORITY_TONE[task.priority]].join(' ')} aria-label={task.priority} />
        <span className="task-card__title">{task.title}</span>
        {assignee ? (
          <Avatar
            src={assignee.avatarUrl}
            name={assignee.fullName}
            size="xs"
            alt={`Assigned to ${assignee.fullName}`}
          />
        ) : task.assigneeId ? null : (
          <span className="task-card__unassigned" title="Unassigned" />
        )}
      </div>
      <div className="task-card__row task-card__row--meta">
        <StatusBadge status={task.status} />
      </div>
    </button>
  );
}
