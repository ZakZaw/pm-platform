import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import './KanbanCard.css';

const PRIORITY_TONE = {
  Urgent: 'prio-urgent',
  High: 'prio-high',
  Medium: 'prio-med',
  Low: 'prio-low',
};

export function KanbanCard({ card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card:${card.storyId}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="kanban-card"
    >
      <div className="kanban-card__row">
        <span className={['kanban-card__prio', PRIORITY_TONE[card.priority]].join(' ')} aria-label={card.priority} />
        <span className="kanban-card__title">{card.title}</span>
      </div>
      <div className="kanban-card__row kanban-card__meta">
        {card.storyPoints != null && (
          <span className="kanban-card__pts">{card.storyPoints} pts</span>
        )}
        {card.taskCount > 0 && (
          <span className="kanban-card__tasks">
            {card.completedTaskCount}/{card.taskCount} tasks
          </span>
        )}
      </div>
    </div>
  );
}
