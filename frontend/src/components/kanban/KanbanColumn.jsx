import { useDroppable } from '@dnd-kit/core';
import { Badge, StatusBadge } from '@/components/ui';
import './KanbanColumn.css';

export function KanbanColumn({ status, count, displayName, tone, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: `col:${status}` });
  return (
    <div
      ref={setNodeRef}
      className={['kanban-col', isOver ? 'is-over' : ''].filter(Boolean).join(' ')}
    >
      <header className="kanban-col__head">
        {displayName ? (
          <Badge tone={tone ?? 'neutral'}>{displayName}</Badge>
        ) : (
          <StatusBadge status={status} />
        )}
        <span className="kanban-col__count">{count}</span>
      </header>
      <div className="kanban-col__body">{children}</div>
    </div>
  );
}
