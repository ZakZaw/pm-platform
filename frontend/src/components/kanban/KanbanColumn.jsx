import { useDroppable } from '@dnd-kit/core';
import { StatusBadge } from '@/components/ui';
import './KanbanColumn.css';

export function KanbanColumn({ status, count, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: `col:${status}` });
  return (
    <div
      ref={setNodeRef}
      className={['kanban-col', isOver ? 'is-over' : ''].filter(Boolean).join(' ')}
    >
      <header className="kanban-col__head">
        <StatusBadge status={status} />
        <span className="kanban-col__count">{count}</span>
      </header>
      <div className="kanban-col__body">{children}</div>
    </div>
  );
}
