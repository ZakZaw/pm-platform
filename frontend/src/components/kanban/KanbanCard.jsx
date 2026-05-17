import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useParams } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import './KanbanCard.css';

const PRIORITY_TONE = {
  Urgent: 'prio-urgent',
  High: 'prio-high',
  Medium: 'prio-med',
  Low: 'prio-low',
};

const PRIORITY_LABEL = {
  Urgent: 'Urgent',
  High: 'High',
  Medium: 'Medium',
  Low: 'Low',
};

export function KanbanCard({ card, onOpen, epic }) {
  const { slug: orgSlug } = useParams();
  const { members } = useOrgMembers(orgSlug);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card:${card.taskId}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };
  const assignee = card.assigneeId ? members.find((m) => m.userId === card.assigneeId) : null;

  function handleClick() {
    if (isDragging) return;
    onOpen?.(card.taskId);
  }

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.(card.taskId);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      onKeyDown={handleKey}
      className="kanban-card"
      role="button"
      tabIndex={0}
      aria-label={`${card.title} — ${PRIORITY_LABEL[card.priority]} priority`}
    >
      {epic?.color && (
        <span
          className="kanban-card__epic-stripe"
          style={{ background: epic.color }}
          aria-hidden="true"
        />
      )}
      <div className="kanban-card__body">
        <div className="kanban-card__head">
          <span
            className={['kanban-card__prio', PRIORITY_TONE[card.priority]].join(' ')}
            title={`${PRIORITY_LABEL[card.priority]} priority`}
            aria-hidden="true"
          />
          <span className="kanban-card__title">{card.title}</span>
        </div>
        {epic && (
          <div className="kanban-card__epic" title={epic.title}>
            <span className="kanban-card__epic-dot" style={{ background: epic.color || 'var(--accent-primary)' }} />
            <span className="kanban-card__epic-name">{epic.title}</span>
          </div>
        )}
        <div className="kanban-card__foot">
          <div className="kanban-card__chips">
            {card.storyPoints != null && (
              <span className="kanban-card__pts" title="Story points">
                {card.storyPoints} pts
              </span>
            )}
            {card.subtaskCount > 0 && (
              <span className="kanban-card__tasks" title="Subtasks complete">
                <CheckSquare size={11} aria-hidden="true" />
                {card.completedSubtaskCount}/{card.subtaskCount}
              </span>
            )}
          </div>
          {assignee ? (
            <Avatar
              src={assignee.avatarUrl}
              name={assignee.fullName}
              size="xs"
              alt={`Assigned to ${assignee.fullName}`}
            />
          ) : (
            <span className="kanban-card__unassigned" title="Unassigned" />
          )}
        </div>
      </div>
    </div>
  );
}
