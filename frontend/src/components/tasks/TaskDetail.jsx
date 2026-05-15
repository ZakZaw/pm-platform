import { useCallback, useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { tasksApi } from '@/api/tasks.api';
import { subtasksApi } from '@/api/subtasks.api';
import { commentsApi } from '@/api/comments.api';
import { StatusDropdown } from './StatusDropdown';
import { CommentList } from './CommentList';
import { CommentInput } from './CommentInput';
import './TaskDetail.css';

/**
 * Drawer-style task detail. Shown by the story page when a task card is
 * clicked. Owns subtask list edits; status changes flow up to the parent
 * via onUpdated so the parent stays the single source of truth for the
 * task object.
 */
export function TaskDetail({ task, projectId, onClose, onUpdated, onDeleted }) {
  const toast = useToast();
  const [subtasks, setSubtasks] = useState([]);
  const [newSub, setNewSub] = useState('');
  const [comments, setComments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    subtasksApi
      .listForTask(task.id)
      .then((list) => {
        if (!cancelled) setSubtasks(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  const refreshComments = useCallback(async () => {
    try {
      const list = await commentsApi.listForTask(task.id);
      setComments(list);
    } catch {
      /* surfaced by the section if needed */
    }
  }, [task.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await commentsApi.listForTask(task.id);
        if (!cancelled) setComments(list);
      } catch {
        /* leave list empty on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  async function postComment(body) {
    try {
      const created = await commentsApi.create(task.id, body);
      setComments((cur) => [...cur, created]);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not post comment.',
      });
      throw err;
    }
  }

  async function changeStatus(to) {
    let reason = null;
    if (to === 'Blocked' || to === 'WontDo') {
      reason = window.prompt(`Reason for moving to ${to}?`)?.trim() ?? '';
      if (!reason) return;
    }
    try {
      const updated = await tasksApi.changeStatus(task.id, { to, reason });
      onUpdated?.(updated);
      toast.show({ tone: 'success', message: `Moved to ${to}.` });
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Could not change status.';
      toast.show({ tone: 'danger', title: 'Invalid transition', message: detail });
    }
  }

  async function addSubtask(e) {
    e.preventDefault();
    if (newSub.trim().length === 0) return;
    try {
      const created = await subtasksApi.create(task.id, { title: newSub.trim() });
      setSubtasks((cur) => [...cur, created]);
      setNewSub('');
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not add subtask.',
      });
    }
  }

  async function toggleSubtask(sub) {
    try {
      const updated = await subtasksApi.update(sub.id, { completed: !sub.completed });
      setSubtasks((cur) => cur.map((s) => (s.id === sub.id ? updated : s)));
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not update subtask.',
      });
    }
  }

  async function removeSubtask(sub) {
    try {
      await subtasksApi.remove(sub.id);
      setSubtasks((cur) => cur.filter((s) => s.id !== sub.id));
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not remove subtask.',
      });
    }
  }

  async function deleteTask() {
    if (!window.confirm('Delete this task? Subtasks will also be removed.')) return;
    try {
      await tasksApi.remove(task.id);
      onDeleted?.(task);
      onClose?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not delete task.',
      });
    }
  }

  return (
    <aside className="task-detail" aria-label={`Task: ${task.title}`}>
      <header className="task-detail__head">
        <button type="button" className="task-detail__close" onClick={onClose} aria-label="Close">
          <X size={16} aria-hidden="true" />
        </button>
        <h2 className="task-detail__title">{task.title}</h2>
        <div className="task-detail__head-row">
          <StatusDropdown status={task.status} onChange={changeStatus} />
          <span className="task-detail__priority">Priority: {task.priority}</span>
        </div>
      </header>

      {task.description && (
        <section className="task-detail__section">
          <h3 className="task-detail__heading">Description</h3>
          <p className="task-detail__desc">{task.description}</p>
        </section>
      )}

      <section className="task-detail__section">
        <h3 className="task-detail__heading">Subtasks</h3>
        {subtasks.length === 0 && (
          <p className="task-detail__placeholder">No subtasks yet.</p>
        )}
        <ul className="task-detail__sub-list">
          {subtasks.map((s) => (
            <li key={s.id} className="task-detail__sub">
              <label className="task-detail__sub-check">
                <input
                  type="checkbox"
                  checked={s.completed}
                  onChange={() => toggleSubtask(s)}
                />
                <span className={s.completed ? 'task-detail__sub-done' : ''}>{s.title}</span>
              </label>
              <button
                type="button"
                className="task-detail__sub-remove"
                onClick={() => removeSubtask(s)}
                aria-label="Remove subtask"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addSubtask} className="task-detail__sub-form">
          <input
            type="text"
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            placeholder="Add subtask…"
            className="task-detail__sub-input"
          />
          <Button size="sm" type="submit" disabled={newSub.trim().length === 0}>Add</Button>
        </form>
      </section>

      <section className="task-detail__section">
        <h3 className="task-detail__heading">Comments</h3>
        <CommentList
          projectId={projectId}
          comments={comments}
          onChanged={refreshComments}
        />
        <div className="task-detail__comment-input">
          <CommentInput projectId={projectId} onSubmit={postComment} />
        </div>
      </section>

      <footer className="task-detail__foot">
        <Button variant="danger" size="sm" onClick={deleteTask}>Delete task</Button>
      </footer>
    </aside>
  );
}
