import { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { Badge, Button, StatusBadge } from '@/components/ui';
import './KanbanColumn.css';

export function KanbanColumn({
  status,
  count,
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
      <header className="kanban-col__head">
        {displayName ? (
          <Badge tone={tone ?? 'neutral'}>{displayName}</Badge>
        ) : (
          <StatusBadge status={status} />
        )}
        <span className="kanban-col__count">{count}</span>
      </header>
      <div className="kanban-col__body">{children}</div>
      {onAddTask && (
        <div className="kanban-col__footer">
          {adding ? (
            <form className="kanban-col__add-form" onSubmit={submit}>
              <input
                ref={inputRef}
                className="kanban-col__add-input"
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
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || title.trim().length < 2}
                >
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
              <Plus size={14} aria-hidden="true" /> Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
