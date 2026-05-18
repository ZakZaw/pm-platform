import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  Copy,
  Edit3,
  Eye,
  GitCommit,
  GitPullRequest,
  History,
  Layers,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  AssigneePicker,
  Badge,
  Button,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { tasksApi } from '@/api/tasks.api';
import { subtasksApi } from '@/api/subtasks.api';
import { commentsApi } from '@/api/comments.api';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { StatusDropdown } from './StatusDropdown';
import { PriorityDropdown } from './PriorityDropdown';
import { CommentList } from './CommentList';
import { CommentInput } from './CommentInput';
import './TaskDetail.css';

function shortKey(task) {
  // task.key is the human-friendly ID like "AT-247" (Project.Key + Task.KeyNum)
  // from the API. Fall back to a UUID tail only defensively.
  if (task?.key) return task.key;
  const id = String(task?.id ?? '');
  return id ? id.slice(0, 4).toUpperCase() : '—';
}

function fmtDueDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function MetaRow({ label, children }) {
  return (
    <div className="task-detail__meta-row">
      <div className="task-detail__meta-label">{label}</div>
      <div className="task-detail__meta-value">{children}</div>
    </div>
  );
}

export function TaskDetail({ task, projectId, onClose, onUpdated, onDeleted }) {
  const { slug: orgSlug } = useParams();
  const { members } = useOrgMembers(orgSlug);
  const toast = useToast();

  const [subtasks, setSubtasks] = useState([]);
  const [newSub, setNewSub] = useState('');
  const [comments, setComments] = useState([]);
  const [activeTab, setActiveTab] = useState('comments');

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
      /* surfaced by section if needed */
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

  async function changeAssignee(userId) {
    const body = userId == null ? { clearAssignee: true } : { assigneeId: userId };
    try {
      const updated = await tasksApi.update(task.id, body);
      onUpdated?.(updated);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not change assignee.',
      });
    }
  }

  async function changeReviewer(userId) {
    const body = userId == null ? { clearReviewer: true } : { reviewerId: userId };
    try {
      const updated = await tasksApi.update(task.id, body);
      onUpdated?.(updated);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not change reviewer.',
      });
    }
  }

  async function changePriority(priority) {
    try {
      const updated = await tasksApi.update(task.id, { priority });
      onUpdated?.(updated);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not change priority.',
      });
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

  function copyKey() {
    navigator.clipboard?.writeText(shortKey(task)).then(
      () => toast.show({ tone: 'success', message: 'Task key copied.' }),
      () => {},
    );
  }

  const reporter = useMemo(() => {
    const id = task.reporterId ?? task.createdBy ?? task.createdById;
    return id ? members.find((m) => m.userId === id) : null;
  }, [task, members]);

  const due = fmtDueDate(task.dueDate);

  return (
    <aside className="task-detail" aria-label={`Task: ${task.title}`}>
      {/* Drawer header */}
      <div className="hstack task-detail__topbar">
        <span className="mono dim task-detail__key">{shortKey(task)}</span>
        <span className="dim">·</span>
        {task.sprintName && <Badge tone="info">{task.sprintName}</Badge>}
        {task.epicTitle && (
          <Badge tone="purple">
            <Layers size={11} aria-hidden="true" /> {task.epicTitle}
          </Badge>
        )}
        <div className="grow" />
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          onClick={copyKey}
          title="Copy task key"
          aria-label="Copy task key"
        >
          <Copy size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          title="Open full page"
          aria-label="Open full page"
          disabled
        >
          <ArrowUpRight size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          title="More"
          aria-label="More"
        >
          <MoreHorizontal size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          onClick={onClose}
          title="Close"
          aria-label="Close"
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>

      {/* Body grid */}
      <div className="task-detail__body">
        <div className="task-detail__main">
          <button
            type="button"
            className="task-detail__id-chip"
            onClick={copyKey}
            title="Copy task ID"
            aria-label={`Copy task ID ${shortKey(task)}`}
          >
            <span className="mono">{shortKey(task)}</span>
            <Copy size={11} aria-hidden="true" />
          </button>
          <div className="task-detail__title">{task.title}</div>
          <div className="hstack task-detail__byline">
            {reporter && (
              <span className="hstack" style={{ gap: 4 }}>
                <User size={12} aria-hidden="true" /> {reporter.fullName} reported
              </span>
            )}
            <span>·</span>
            <span className="hstack" style={{ gap: 4 }}>
              <Eye size={12} aria-hidden="true" /> {task.watcherCount ?? 0} watchers
            </span>
          </div>

          {task.description && (
            <>
              <div className="subsection-eyebrow">Description</div>
              <p className="task-detail__desc">{task.description}</p>
            </>
          )}

          <div className="subsection-eyebrow">Acceptance criteria</div>
          {subtasks.length === 0 && (
            <p className="task-detail__placeholder">No acceptance criteria yet.</p>
          )}
          <ul className="task-detail__ac">
            {subtasks.map((s) => (
              <li key={s.id} className="task-detail__ac-row">
                <label className="task-detail__ac-check">
                  <input
                    type="checkbox"
                    checked={s.completed}
                    onChange={() => toggleSubtask(s)}
                  />
                  <span className="task-detail__ac-box" aria-hidden="true">
                    {s.completed && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className={s.completed ? 'task-detail__ac-done' : ''}>{s.title}</span>
                </label>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm task-detail__ac-remove"
                  onClick={() => removeSubtask(s)}
                  aria-label="Remove criterion"
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addSubtask} className="task-detail__ac-form">
            <input
              type="text"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              placeholder="Add criterion…"
              className="input task-detail__ac-input"
            />
            <Button size="sm" type="submit" disabled={newSub.trim().length === 0}>
              Add
            </Button>
          </form>

          {/* Activity */}
          <div className="subsection-eyebrow">Activity</div>
          <div className="tabs task-detail__tabs">
            <button
              type="button"
              className={['tab', activeTab === 'comments' ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setActiveTab('comments')}
            >
              <MessageSquare size={12} aria-hidden="true" /> Comments
              <span className="count">{comments.length}</span>
            </button>
            <button
              type="button"
              className={['tab', activeTab === 'history' ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setActiveTab('history')}
            >
              <History size={12} aria-hidden="true" /> History
            </button>
            <button
              type="button"
              className={['tab', activeTab === 'commits' ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setActiveTab('commits')}
            >
              <GitPullRequest size={12} aria-hidden="true" /> Commits
            </button>
          </div>

          <div className="task-detail__activity">
            {activeTab === 'comments' && (
              <CommentList
                projectId={projectId}
                comments={comments}
                onChanged={refreshComments}
              />
            )}
            {activeTab === 'history' && (
              <p className="task-detail__placeholder">
                <GitCommit size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Field-change history isn’t wired up yet — coming in Phase 2.
              </p>
            )}
            {activeTab === 'commits' && (
              <p className="task-detail__placeholder">
                <Maximize2 size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Connect a repo in Settings to surface commits and PRs here.
              </p>
            )}
          </div>
        </div>

        <div className="task-detail__meta">
          <MetaRow label="Status">
            <StatusDropdown status={task.status} onChange={changeStatus} />
          </MetaRow>
          <MetaRow label="Assignee">
            <AssigneePicker orgSlug={orgSlug} value={task.assigneeId ?? null} onChange={changeAssignee} />
          </MetaRow>
          <MetaRow label="Reviewer">
            <AssigneePicker orgSlug={orgSlug} value={task.reviewerId ?? null} onChange={changeReviewer} />
          </MetaRow>
          <MetaRow label="Priority">
            <PriorityDropdown value={task.priority} onChange={changePriority} />
          </MetaRow>
          {task.storyPoints != null && (
            <MetaRow label="Points">
              <span className="mono task-detail__pts">{task.storyPoints}</span>
            </MetaRow>
          )}
          {due && (
            <MetaRow label="Due">
              <span style={{ fontSize: 12 }}>{due}</span>
            </MetaRow>
          )}
          {task.sprintName && (
            <MetaRow label="Sprint">
              <Badge tone="info">{task.sprintName}</Badge>
            </MetaRow>
          )}
          {task.epicTitle && (
            <MetaRow label="Epic">
              <span className="hstack" style={{ gap: 6, fontSize: 12, color: 'var(--accent-primary)' }}>
                <Layers size={11} aria-hidden="true" /> {task.epicTitle}
              </span>
            </MetaRow>
          )}
          {task.labels?.length > 0 && (
            <MetaRow label="Labels">
              <div className="hstack" style={{ flexWrap: 'wrap', gap: 4 }}>
                {task.labels.map((l) => (
                  <Badge key={l} tone="neutral" dot>
                    {l}
                  </Badge>
                ))}
              </div>
            </MetaRow>
          )}

          <div className="task-detail__divider" />

          <button
            type="button"
            className="task-detail__delete"
            onClick={deleteTask}
          >
            <Trash2 size={12} aria-hidden="true" /> Delete task
          </button>
        </div>
      </div>

      {/* Composer */}
      <div className="task-detail__composer">
        <CommentInput projectId={projectId} onSubmit={postComment} />
      </div>
    </aside>
  );
}

// Export reporter helper for tests if needed later.
export const __test__ = { shortKey };
