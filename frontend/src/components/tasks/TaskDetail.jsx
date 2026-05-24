import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Eye,
  GitCommit,
  GitPullRequest,
  History,
  Layers,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  AssigneePicker,
  Button,
  useToast,
} from '@/components/ui';
import { tasksApi } from '@/api/tasks.api';
import { subtasksApi } from '@/api/subtasks.api';
import { commentsApi } from '@/api/comments.api';
import { epicsApi } from '@/api/epics.api';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useConfirm } from '@/hooks/useConfirm';
import { AITaskBreakdownModal } from '@/components/ai/AITaskBreakdownModal';
import { describeAiError } from '@/components/ai/aiErrors';
import { aiApi } from '@/api/ai.api';
import { AISuggestionCard } from '@/components/ui';
import { StatusDropdown } from './StatusDropdown';
import { PriorityDropdown } from './PriorityDropdown';
import { EpicPicker } from './EpicPicker';
import { SprintPicker } from './SprintPicker';
import { CommentList } from './CommentList';
import { CommentInput } from './CommentInput';
import './TaskDetail.css';

const DEFAULT_TASK_COLOR = 'var(--accent)';

function shortKey(task) {
  if (task?.key) return task.key;
  const id = String(task?.id ?? '');
  return id ? id.slice(0, 4).toUpperCase() : '—';
}

function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
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
  const { confirm, dialog } = useConfirm();

  const [subtasks, setSubtasks] = useState([]);
  const [newSub, setNewSub] = useState('');
  const [comments, setComments] = useState([]);
  const [activeTab, setActiveTab] = useState('comments');

  // Editable buffers — reset whenever the underlying task changes server-side
  // by remounting via parent key, or by useEffect resyncing from prop.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(task.description ?? '');
  const [pointsDraft, setPointsDraft] = useState(
    task.storyPoints == null ? '' : String(task.storyPoints),
  );
  const [editingPrUrl, setEditingPrUrl] = useState(false);
  const [prUrlDraft, setPrUrlDraft] = useState(task.prUrl ?? '');
  const [aiBreakdownOpen, setAiBreakdownOpen] = useState(false);
  const [aiEstimate, setAiEstimate] = useState(null);
  const [aiEstimateLoading, setAiEstimateLoading] = useState(false);

  useEffect(() => {
    setTitleDraft(task.title);
    setDescDraft(task.description ?? '');
    setPointsDraft(task.storyPoints == null ? '' : String(task.storyPoints));
    setPrUrlDraft(task.prUrl ?? '');
  }, [task.id, task.title, task.description, task.storyPoints, task.prUrl]);

  // Fetch the project's epics so we can render the color swatch beside the
  // task and resolve a name for the inline display. EpicPicker has its own
  // copy; the duplicate request is one network call and keeps both pieces
  // simple.
  const [epics, setEpics] = useState([]);
  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    epicsApi
      .listForProject(projectId)
      .then((list) => {
        if (!cancelled) setEpics(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const currentEpic = task.epicId ? epics.find((e) => e.id === task.epicId) : null;
  const epicColor = currentEpic?.color || DEFAULT_TASK_COLOR;

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

  async function patch(body, errMsg = 'Could not save change.') {
    try {
      const updated = await tasksApi.update(task.id, body);
      onUpdated?.(updated);
      return updated;
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? errMsg,
      });
      return null;
    }
  }

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
    await patch(
      userId == null ? { clearAssignee: true } : { assigneeId: userId },
      'Could not change assignee.',
    );
  }

  async function changeReviewer(userId) {
    await patch(
      userId == null ? { clearReviewer: true } : { reviewerId: userId },
      'Could not change reviewer.',
    );
  }

  async function changePriority(priority) {
    await patch({ priority }, 'Could not change priority.');
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

  function commitTitle() {
    const t = titleDraft.trim();
    if (t === task.title) {
      setEditingTitle(false);
      return;
    }
    if (t.length < 2 || t.length > 200) {
      toast.show({ tone: 'danger', message: 'Title must be 2–200 characters.' });
      setTitleDraft(task.title);
      setEditingTitle(false);
      return;
    }
    patch({ title: t }, 'Could not change title.');
    setEditingTitle(false);
  }

  function commitDesc() {
    if (descDraft === (task.description ?? '')) {
      setEditingDesc(false);
      return;
    }
    patch({ description: descDraft }, 'Could not change description.');
    setEditingDesc(false);
  }

  function commitPoints() {
    const raw = pointsDraft.trim();
    if (raw === '') {
      // Empty string clears. Backend takes int? so null clears via storyPoints=0?
      // The UpdateTaskCommand uses HasValue — there's no clearStoryPoints flag,
      // so the closest we can do is set 0. We treat empty as 0 to mean "none".
      patch({ storyPoints: 0 }, 'Could not change points.');
      return;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0 || n > 200) {
      toast.show({ tone: 'danger', message: 'Points must be 0–200.' });
      setPointsDraft(task.storyPoints == null ? '' : String(task.storyPoints));
      return;
    }
    if (n === (task.storyPoints ?? 0)) return;
    patch({ storyPoints: n }, 'Could not change points.');
  }

  function commitDueDate(value) {
    if (!value) {
      patch({ clearDueDate: true }, 'Could not clear due date.');
      return;
    }
    const iso = new Date(`${value}T00:00:00Z`).toISOString();
    patch({ dueDate: iso }, 'Could not set due date.');
  }

  function commitPrUrl() {
    const v = prUrlDraft.trim();
    if (v === (task.prUrl ?? '')) {
      setEditingPrUrl(false);
      return;
    }
    patch({ prUrl: v }, 'Could not set PR URL.');
    setEditingPrUrl(false);
  }

  function changeEpic(epicId) {
    patch(
      epicId == null ? { clearEpic: true } : { epicId },
      'Could not change epic.',
    );
  }

  function changeSprint(sprintId) {
    patch(
      sprintId == null ? { clearSprint: true } : { sprintId },
      'Could not change sprint.',
    );
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

  async function requestAiEstimate() {
    setAiEstimateLoading(true);
    try {
      const result = await aiApi.estimateTask(task.id);
      setAiEstimate(result);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: describeAiError(err, 'Could not estimate.'),
      });
    } finally {
      setAiEstimateLoading(false);
    }
  }

  async function applyAiEstimate() {
    if (!aiEstimate) return;
    const ok = await patch(
      { storyPoints: aiEstimate.points },
      'Could not apply estimate.',
    );
    if (ok) {
      setAiEstimate(null);
      toast.show({ tone: 'success', message: `Set points to ${aiEstimate.points}.` });
    }
  }

  async function applyAiBreakdown(p) {
    setAiBreakdownOpen(false);
    const taskPatch = {};
    if (p.description !== undefined) taskPatch.description = p.description;
    if (p.storyPoints !== undefined) taskPatch.storyPoints = p.storyPoints;
    if (Object.keys(taskPatch).length > 0) {
      const updated = await patch(taskPatch, 'Could not apply AI changes.');
      if (!updated) return;
    }
    if (p.acceptanceCriteria && p.acceptanceCriteria.length > 0) {
      try {
        const created = [];
        for (const ac of p.acceptanceCriteria) {
          // eslint-disable-next-line no-await-in-loop
          const sub = await subtasksApi.create(task.id, { title: ac });
          created.push(sub);
        }
        setSubtasks((cur) => [...cur, ...created]);
      } catch (err) {
        toast.show({
          tone: 'danger',
          message: err.response?.data?.detail ?? 'Could not add criteria.',
        });
        return;
      }
    }
    toast.show({ tone: 'success', message: 'Applied AI breakdown.' });
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
    const ok = await confirm({
      title: `Delete ${shortKey(task)}?`,
      message: 'This task and every subtask under it will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete task',
    });
    if (!ok) return;
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

  return (
    <>
      {dialog}
      <AITaskBreakdownModal
        open={aiBreakdownOpen}
        taskId={task.id}
        currentTitle={task.title}
        onClose={() => setAiBreakdownOpen(false)}
        onApply={applyAiBreakdown}
      />
      <aside
        className="task-detail"
        aria-label={`Task: ${task.title}`}
        style={{ '--task-color': epicColor }}
      >
        {/* Color accent bar — pulls from the assigned epic, or default. */}
        <div className="task-detail__color-bar" aria-hidden="true" />

        {/* Drawer header */}
        <div className="row task-detail__topbar">
          <span className="mono muted task-detail__key">{shortKey(task)}</span>
          <span
            className="task-detail__color-chip"
            style={{ background: epicColor }}
            title={currentEpic ? `Epic: ${currentEpic.title}` : 'No epic — default color'}
            aria-hidden="true"
          />
          <div className="fill" />
          <button
            type="button"
            className="btn btn-ghost btn-icon-sm"
            onClick={copyKey}
            title="Copy task key"
            aria-label="Copy task key"
          >
            <Copy size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon-sm"
            title="Open full page"
            aria-label="Open full page"
            disabled
          >
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon-sm"
            title="More"
            aria-label="More"
          >
            <MoreHorizontal size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon-sm"
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

            {editingTitle ? (
              <input
                className="task-detail__title-input"
                value={titleDraft}
                autoFocus
                maxLength={200}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTitle();
                  } else if (e.key === 'Escape') {
                    setTitleDraft(task.title);
                    setEditingTitle(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="task-detail__title task-detail__title--edit"
                onClick={() => setEditingTitle(true)}
                title="Click to edit"
              >
                {task.title}
              </button>
            )}

            <div className="row task-detail__byline">
              {reporter && (
                <span className="row gap-2">
                  <User size={12} aria-hidden="true" /> {reporter.fullName} reported
                </span>
              )}
              <span>·</span>
              <span className="row gap-2">
                <Eye size={12} aria-hidden="true" /> {task.watcherCount ?? 0} watchers
              </span>
            </div>

            <div className="eyebrow task-detail__section-eyebrow">Description</div>
            {editingDesc ? (
              <textarea
                className="task-detail__desc-input"
                value={descDraft}
                autoFocus
                rows={4}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={commitDesc}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setDescDraft(task.description ?? '');
                    setEditingDesc(false);
                  } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    commitDesc();
                  }
                }}
              />
            ) : task.description ? (
              <p
                className="task-detail__desc task-detail__desc--edit"
                onClick={() => setEditingDesc(true)}
                title="Click to edit"
              >
                {task.description}
              </p>
            ) : (
              <button
                type="button"
                className="task-detail__desc-empty"
                onClick={() => setEditingDesc(true)}
              >
                Add a description…
              </button>
            )}

            {aiEstimate && (
              <div className="task-detail__ai-estimate">
                <AISuggestionCard
                  chipLabel="AI estimate"
                  title={`Suggested: ${aiEstimate.points} points`}
                  body={aiEstimate.reasoning}
                  footer={`Confidence ${Math.round((aiEstimate.confidence ?? 0) * 100)}%${aiEstimate.confidence < 0.5 ? ' · low — review before applying' : ''}`}
                  applyLabel={`Set to ${aiEstimate.points}`}
                  onApply={applyAiEstimate}
                  onDismiss={() => setAiEstimate(null)}
                />
              </div>
            )}

            <div className="task-detail__ac-head">
              <span className="eyebrow task-detail__section-eyebrow">Acceptance criteria</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAiBreakdownOpen(true)}
                title="Let AI propose a tighter description, acceptance criteria, and points."
              >
                <Sparkles size={11} aria-hidden="true" /> AI: break down
              </Button>
            </div>
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
                    className="btn btn-ghost btn-icon-sm task-detail__ac-remove"
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
            <div className="eyebrow task-detail__section-eyebrow">Activity</div>
            <div className="tabs task-detail__tabs">
              <button
                type="button"
                className={activeTab === 'comments' ? 'is-active' : ''}
                onClick={() => setActiveTab('comments')}
              >
                <MessageSquare size={12} aria-hidden="true" /> Comments
                <span className="tab-count">{comments.length}</span>
              </button>
              <button
                type="button"
                className={activeTab === 'history' ? 'is-active' : ''}
                onClick={() => setActiveTab('history')}
              >
                <History size={12} aria-hidden="true" /> History
              </button>
              <button
                type="button"
                className={activeTab === 'commits' ? 'is-active' : ''}
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

            <MetaRow label="Points">
              <div className="task-detail__pts-row">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={pointsDraft}
                  onChange={(e) => setPointsDraft(e.target.value)}
                  onBlur={commitPoints}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="—"
                  className="task-detail__pts-input"
                  aria-label="Story points"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={requestAiEstimate}
                  disabled={aiEstimateLoading}
                  title="Ask the AI to estimate points based on similar past tasks."
                >
                  <Sparkles size={11} aria-hidden="true" />{' '}
                  {aiEstimateLoading ? 'Thinking…' : 'AI'}
                </Button>
              </div>
            </MetaRow>

            <MetaRow label="Due">
              <div className="task-detail__date-wrap">
                <input
                  type="date"
                  value={toDateInput(task.dueDate)}
                  onChange={(e) => commitDueDate(e.target.value)}
                  className="task-detail__date-input"
                  aria-label="Due date"
                />
                {task.dueDate && (
                  <button
                    type="button"
                    className="task-detail__date-clear"
                    onClick={() => commitDueDate('')}
                    aria-label="Clear due date"
                    title="Clear"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                )}
              </div>
            </MetaRow>

            <MetaRow label="Sprint">
              <SprintPicker
                projectId={projectId}
                value={task.sprintId ?? null}
                onChange={changeSprint}
              />
            </MetaRow>

            <MetaRow label="Epic">
              <EpicPicker
                projectId={projectId}
                value={task.epicId ?? null}
                onChange={changeEpic}
              />
            </MetaRow>

            <MetaRow label="Color">
              <div className="row task-detail__color-row">
                <span
                  className="task-detail__color-swatch"
                  style={{ background: epicColor }}
                  aria-hidden="true"
                />
                <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                  {currentEpic ? `From epic "${currentEpic.title}"` : 'Default'}
                </span>
              </div>
            </MetaRow>

            <MetaRow label="PR URL">
              {editingPrUrl ? (
                <input
                  type="url"
                  value={prUrlDraft}
                  autoFocus
                  className="task-detail__pr-input"
                  placeholder="https://github.com/…"
                  onChange={(e) => setPrUrlDraft(e.target.value)}
                  onBlur={commitPrUrl}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      setPrUrlDraft(task.prUrl ?? '');
                      setEditingPrUrl(false);
                    }
                  }}
                />
              ) : task.prUrl ? (
                <span className="row task-detail__pr-link">
                  <a href={task.prUrl} target="_blank" rel="noreferrer noopener" title={task.prUrl}>
                    <ExternalLink size={11} aria-hidden="true" /> Open PR
                  </a>
                  <button
                    type="button"
                    className="task-detail__pr-edit"
                    onClick={() => setEditingPrUrl(true)}
                  >
                    edit
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="task-detail__pr-empty"
                  onClick={() => setEditingPrUrl(true)}
                >
                  Add URL…
                </button>
              )}
            </MetaRow>

            {currentEpic && (
              <MetaRow label="Epic name">
                <span className="row gap-2" style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)' }}>
                  <Layers size={11} aria-hidden="true" /> {currentEpic.title}
                </span>
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
    </>
  );
}

export const __test__ = { shortKey };
