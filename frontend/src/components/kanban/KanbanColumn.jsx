import { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { STATUS_MAP } from '@/components/ui/StatusBadge/constants';
import './KanbanColumn.css';

// Status → dot color for the column header. Mirrors .status-{key}::before in stratos.css.
const DOT_COLORS = {
  todo: 'var(--text-muted)',
  progress: 'var(--accent-bright)',
  review: 'var(--violet)',
  done: 'var(--success)',
  blocked: 'var(--danger)',
};

const STATUS_TONE_DOT = {
  neutral: 'var(--text-muted)',
  info: 'var(--accent-bright)',
  warning: 'var(--warning)',
  success: 'var(--success)',
  danger: 'var(--danger)',
  violet: 'var(--violet)',
  purple: 'var(--violet)',
  teal: 'var(--teal)',
  rose: 'var(--rose)',
};

export function KanbanColumn({
  status,
  count,
  points,
  displayName,
  tone,
  wipLimit = null,
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

  const statusKey = STATUS_MAP[status]?.key ?? 'todo';
  const dotColor = STATUS_TONE_DOT[tone] ?? DOT_COLORS[statusKey] ?? 'var(--text-muted)';
  const label = displayName ?? STATUS_MAP[status]?.label ?? status;
  const wipExceeded = wipLimit != null && count > wipLimit;

  return (
    <div
      ref={setNodeRef}
      className={[
        'kanban-col',
        isOver ? 'is-over' : '',
        wipExceeded ? 'is-wip-exceeded' : '',
      ].filter(Boolean).join(' ')}
    >
      <header className="kanban-col-head">
        <div className="kanban-col-title">
          <span className="kanban-col-title-dot" style={{ background: dotColor }} />
          <span>{label}</span>
          <span
            className={`kanban-col-count ${wipExceeded ? 'is-over-limit' : ''}`}
            title={wipLimit != null ? `WIP limit: ${wipLimit}` : undefined}
          >
            {count}
            {wipLimit != null && (
              <span className="kanban-col-count__limit">/{wipLimit}</span>
            )}
          </span>
        </div>
        <div className="row gap-2">
          {points != null && <span className="kanban-col-count">{points}p</span>}
          {onAddTask && (
            <button
              type="button"
              className="btn btn-ghost btn-icon-sm"
              onClick={() => setAdding(true)}
              aria-label="Add task"
              title="Add task"
            >
              <Plus size={12} aria-hidden="true" />
            </button>
          )}
          <span className="btn btn-ghost btn-icon-sm" aria-hidden="true">
            <MoreHorizontal size={12} />
          </span>
        </div>
      </header>

      <div className="kanban-col-body">
        {children}
        {onAddTask && (
          adding ? (
            <form className="kanban-col-add-form" onSubmit={submit}>
              <input
                ref={inputRef}
                className="input"
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
              <div className="kanban-col-add-actions">
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
              className="kanban-col-add-trigger"
              onClick={() => setAdding(true)}
            >
              + Add task
            </button>
          )
        )}
      </div>
    </div>
  );
}
