import { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { MoreHorizontal, Plus } from 'lucide-react';
import { Badge, Button, StatusBadge } from '@/components/ui';
import './KanbanColumn.css';

export function KanbanColumn({
  status,
  count,
  points,
  displayName,
  tone,
  children,
  onAddTask,
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `col:${status}` });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  async function submit(e) {
    e?.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onAddTask?.(t);
      setTitle('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={['kanban-col', isOver ? 'is-over' : ''].filter(Boolean).join(' ')}
    >
      <header className="hstack kanban-col__head">
        <div className="hstack" style={{ gap: 8 }}>
          {displayName ? (
            <Badge tone={tone ?? 'neutral'}>{displayName}</Badge>
          ) : (
            <StatusBadge status={status} />
          )}
          <span className="mono dim kanban-col__count">
            {count}
            {points != null && ` · ${points}pt`}
          </span>
        </div>
        <div className="hstack" style={{ gap: 2 }}>
          {onAddTask && (
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={() => setAdding(true)}
              aria-label="Add task"
              title="Add task"
            >
              <Plus size={12} aria-hidden="true" />
            </button>
          )}
          <span className="icon-btn icon-btn-sm" aria-hidden="true">
            <MoreHorizontal size={12} />
          </span>
        </div>
      </header>

      <div className="kanban-col__body">{children}</div>

      {onAddTask && (
        <div className="kanban-col__footer">
          {adding ? (
            <form className="kanban-col__add-form" onSubmit={submit}>
              <input
                ref={inputRef}
                className="input kanban-col__add-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setAdding(false);
                    setTitle('');
                  }
                }}
                placeholder="Task title"
                maxLength={200}
              />
              <div className="kanban-col__add-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setTitle('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={busy || title.trim().length < 2}>
                  {busy ? 'Adding…' : 'Add'}
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="kanban-col__add-trigger"
              onClick={() => setAdding(true)}
            >
              + Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
