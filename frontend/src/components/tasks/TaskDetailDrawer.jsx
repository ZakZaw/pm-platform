import { useEffect, useState } from 'react';
import { TaskDetail } from './TaskDetail';
import { tasksApi } from '@/api/tasks.api';
import './TaskDetailDrawer.css';

/**
 * Right-side overlay that loads a task by id and renders TaskDetail.
 * Backdrop click and Escape close the drawer. Owners pass onChanged
 * so the underlying list refreshes when the task is edited or deleted.
 */
export function TaskDetailDrawer({ taskId, projectId, onClose, onChanged }) {
  const [task, setTask] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setTask(null);
    setError(null);
    tasksApi.get(taskId)
      .then((t) => { if (!cancelled) setTask(t); })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load task.');
      });
    return () => { cancelled = true; };
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, onClose]);

  if (!taskId) return null;

  return (
    <div className="task-drawer__backdrop" onClick={onClose} role="presentation">
      <div
        className="task-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        onClick={(e) => e.stopPropagation()}
      >
        {error && <p className="task-drawer__placeholder">{error}</p>}
        {!error && !task && <p className="task-drawer__placeholder">Loading…</p>}
        {task && (
          <TaskDetail
            task={task}
            projectId={projectId ?? task.projectId}
            onClose={onClose}
            onUpdated={(t) => {
              setTask(t);
              onChanged?.();
            }}
            onDeleted={() => {
              onChanged?.();
              onClose?.();
            }}
          />
        )}
      </div>
    </div>
  );
}
