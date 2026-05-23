import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Layers, Plus, Sparkles } from 'lucide-react';
import { Avatar, AssigneePicker, Badge, Button, Card, useToast } from '@/components/ui';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { AITaskListWizardModal } from '@/components/ai/AITaskListWizardModal';
import { projectsApi } from '@/api/projects.api';
import { epicsApi } from '@/api/epics.api';
import { tasksApi } from '@/api/tasks.api';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import './EpicDetailPage.css';

const PRIORITY_TONE = {
  Urgent: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
};

const STATUS_TONE = {
  Planning: 'neutral',
  InProgress: 'info',
  Done: 'success',
  Archived: 'neutral',
};

const STATUS_OPTIONS = ['Planning', 'InProgress', 'Done', 'Archived'];

// Stratos epic palette — kept short so the picker reads as a row of swatches.
const COLOR_OPTIONS = [
  'var(--accent)',
  '#4FD1E0',
  '#A78BFA',
  '#3FB984',
  '#E0A23A',
  '#E5484D',
  '#C77BFF',
  '#4F9EFF',
];

// Convert a token-style or hex color to the literal value we send to the
// backend. The Epic.Color column accepts any string; UI keeps these flat.
function normalizeColor(c) {
  if (!c) return '';
  if (c.startsWith('var(')) return c; // keep token reference as-is for theme awareness
  return c;
}

export function EpicDetailPage() {
  const { slug: orgSlug, projectSlug, epicId } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [epic, setEpic] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [openedTaskId, setOpenedTaskId] = useState(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const { members } = useOrgMembers(orgSlug);
  const memberById = useMemo(() => {
    const map = {};
    for (const m of members) map[m.userId] = m;
    return map;
  }, [members]);

  const refresh = useCallback(async (projectId) => {
    const [e, t] = await Promise.all([
      epicsApi.get(epicId),
      tasksApi.listForProject(projectId, { epic_id: epicId, include_done: true }),
    ]);
    setEpic(e);
    setTasks(t);
  }, [epicId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load epic.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, refresh]);

  useEffect(() => {
    if (epic) {
      setTitleDraft(epic.title);
      setDescDraft(epic.description ?? '');
    }
  }, [epic?.id, epic?.title, epic?.description]);

  async function patch(body, errMsg = 'Could not save change.') {
    try {
      const updated = await epicsApi.update(epicId, body);
      setEpic(updated);
      return updated;
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? errMsg,
      });
      return null;
    }
  }

  function commitTitle() {
    const t = titleDraft.trim();
    if (t === epic.title) {
      setEditingTitle(false);
      return;
    }
    if (t.length < 2 || t.length > 200) {
      toast.show({ tone: 'danger', message: 'Title must be 2–200 characters.' });
      setTitleDraft(epic.title);
      setEditingTitle(false);
      return;
    }
    patch({ title: t }, 'Could not rename epic.');
    setEditingTitle(false);
  }

  function commitDesc() {
    if (descDraft === (epic.description ?? '')) {
      setEditingDesc(false);
      return;
    }
    patch({ description: descDraft }, 'Could not change description.');
    setEditingDesc(false);
  }

  async function addTaskToEpic(e) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (title.length < 2 || !project) return;
    setCreating(true);
    try {
      await tasksApi.create(project.id, {
        title,
        priority: 'Medium',
        epicId,
      });
      setNewTaskTitle('');
      await refresh(project.id);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not create task.',
      });
    } finally {
      setCreating(false);
    }
  }

  if (error) return <p className="epic-detail__placeholder">{error}</p>;
  if (!epic || !project) return <p className="epic-detail__placeholder">Loading…</p>;

  const pct = epic.totalStoryPoints > 0
    ? Math.round((epic.doneStoryPoints / epic.totalStoryPoints) * 100)
    : 0;

  return (
    <div className="page epic-detail">
      <Link
        to={`/${orgSlug}/projects/${projectSlug}/epics`}
        className="epic-detail__back"
      >
        <ChevronLeft size={14} aria-hidden="true" /> Epics
      </Link>

      <header
        className="epic-detail__header"
        style={{ '--epic-color': epic.color || 'var(--accent)' }}
      >
        <span
          className="epic-detail__color"
          style={{ background: epic.color || 'var(--accent)' }}
        />
        <div className="epic-detail__head-text">
          <div className="epic-detail__head-row">
            <Layers size={18} aria-hidden="true" style={{ color: epic.color || 'var(--accent)' }} />
            {editingTitle ? (
              <input
                className="epic-detail__title-input"
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
                    setTitleDraft(epic.title);
                    setEditingTitle(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="epic-detail__title epic-detail__title--edit"
                onClick={() => setEditingTitle(true)}
                title="Click to rename"
              >
                {epic.title}
              </button>
            )}
            <select
              className="epic-detail__status"
              value={epic.status}
              onChange={(e) => patch({ status: e.target.value }, 'Could not change status.')}
              aria-label="Epic status"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <label className="epic-detail__risk">
              <input
                type="checkbox"
                checked={epic.riskFlag}
                onChange={(e) => patch({ riskFlag: e.target.checked }, 'Could not change risk flag.')}
              />
              <span>At risk</span>
            </label>
          </div>
          <div className="epic-detail__meta">
            <span>{epic.taskCount} {epic.taskCount === 1 ? 'task' : 'tasks'}</span>
            <span>·</span>
            <span>{epic.doneStoryPoints}/{epic.totalStoryPoints} pts</span>
            <span>·</span>
            <span>{pct}% complete</span>
            <Badge tone={STATUS_TONE[epic.status] ?? 'neutral'}>{epic.status}</Badge>
          </div>
          <div className="epic-detail__bar" aria-label={`Progress ${pct}%`}>
            <div className="epic-detail__bar-fill" style={{ width: `${pct}%`, background: epic.color || 'var(--accent)' }} />
          </div>
        </div>
      </header>

      <div className="epic-detail__row">
        <Card className="epic-detail__section">
          <h2 className="epic-detail__heading">Description</h2>
          {editingDesc ? (
            <textarea
              className="epic-detail__desc-input"
              value={descDraft}
              autoFocus
              rows={4}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={commitDesc}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDescDraft(epic.description ?? '');
                  setEditingDesc(false);
                } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  commitDesc();
                }
              }}
            />
          ) : epic.description ? (
            <p
              className="epic-detail__desc epic-detail__desc--edit"
              onClick={() => setEditingDesc(true)}
              title="Click to edit"
            >
              {epic.description}
            </p>
          ) : (
            <button
              type="button"
              className="epic-detail__desc-empty"
              onClick={() => setEditingDesc(true)}
            >
              Add a description…
            </button>
          )}
        </Card>

        <Card className="epic-detail__section epic-detail__section--meta">
          <h2 className="epic-detail__heading">Settings</h2>

          <div className="epic-detail__field">
            <span className="epic-detail__field-label">Color</span>
            <div className="epic-detail__color-grid">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={[
                    'epic-detail__color-swatch',
                    epic.color === c ? 'is-active' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ background: c }}
                  onClick={() => patch({ color: normalizeColor(c) }, 'Could not change color.')}
                  aria-label={`Set color to ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="epic-detail__field">
            <span className="epic-detail__field-label">Owner</span>
            <AssigneePicker
              orgSlug={orgSlug}
              value={epic.ownerId ?? null}
              onChange={(userId) =>
                patch(
                  userId == null ? { ownerId: null } : { ownerId: userId },
                  'Could not change owner.',
                )
              }
            />
          </div>
        </Card>
      </div>

      <Card className="epic-detail__section">
        <header className="epic-detail__tasks-head">
          <h2 className="epic-detail__heading">Tasks ({tasks.length})</h2>
          <Button variant="ai" size="sm" onClick={() => setAiOpen(true)}>
            <Sparkles size={12} aria-hidden="true" /> AI tasks
          </Button>
        </header>

        <AITaskListWizardModal
          open={aiOpen}
          projectId={project.id}
          epicId={epicId}
          fixedEpic
          onClose={() => setAiOpen(false)}
          onCreated={() => {
            setAiOpen(false);
            refresh(project.id).catch(() => {});
          }}
        />

        <form className="epic-detail__create" onSubmit={addTaskToEpic}>
          <input
            type="text"
            className="epic-detail__create-input"
            placeholder="Add a task to this epic…"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            maxLength={200}
          />
          <Button
            type="submit"
            size="sm"
            disabled={creating || newTaskTitle.trim().length < 2}
          >
            <Plus size={14} aria-hidden="true" /> Add
          </Button>
        </form>

        {tasks.length === 0 ? (
          <p className="epic-detail__placeholder">No tasks in this epic yet.</p>
        ) : (
          <ul className="epic-detail__tasks">
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                assignee={t.assigneeId ? memberById[t.assigneeId] : null}
                onOpen={setOpenedTaskId}
              />
            ))}
          </ul>
        )}
      </Card>

      <TaskDetailDrawer
        taskId={openedTaskId}
        projectId={project.id}
        onClose={() => setOpenedTaskId(null)}
        onChanged={() => refresh(project.id).catch(() => {})}
      />
    </div>
  );
}

function TaskRow({ task, assignee, onOpen }) {
  return (
    <li
      className="epic-detail__task is-interactive"
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(task.id);
        }
      }}
    >
      <span className="epic-detail__task-title">{task.title}</span>
      <div className="epic-detail__task-meta">
        <Badge tone="neutral">{task.status}</Badge>
        <Badge tone={PRIORITY_TONE[task.priority] ?? 'neutral'}>{task.priority}</Badge>
        {task.storyPoints != null && <Badge tone="purple">{task.storyPoints} pts</Badge>}
        {assignee && (
          <Avatar src={assignee.avatarUrl} name={assignee.fullName} size="xs" />
        )}
      </div>
    </li>
  );
}
