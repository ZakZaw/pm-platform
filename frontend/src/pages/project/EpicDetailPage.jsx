import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, Sparkles } from 'lucide-react';
import { Avatar, AssigneePicker, Button, Card, Priority, StatusBadge, useToast } from '@/components/ui';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { AITaskListWizardModal } from '@/components/ai/AITaskListWizardModal';
import { projectsApi } from '@/api/projects.api';
import { epicsApi } from '@/api/epics.api';
import { tasksApi } from '@/api/tasks.api';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import './EpicDetailPage.css';

const STATUS_TONE = {
  Planning: 'neutral',
  InProgress: 'info',
  Done: 'success',
  Archived: 'neutral',
};

const STATUS_LABEL = {
  Planning: 'Planning',
  InProgress: 'In progress',
  Done: 'Done',
  Archived: 'Archived',
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

  // Resync the edit buffers during render when the epic's fields change.
  const [draftsFrom, setDraftsFrom] = useState(null);
  if (epic && (epic.id !== draftsFrom?.id || epic.title !== draftsFrom?.title
      || epic.description !== draftsFrom?.description)) {
    setDraftsFrom({ id: epic.id, title: epic.title, description: epic.description });
    setTitleDraft(epic.title);
    setDescDraft(epic.description ?? '');
  }

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

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!epic || !project) return <div className="main-inner"><p className="muted">Loading…</p></div>;

  const pct = epic.totalStoryPoints > 0
    ? Math.round((epic.doneStoryPoints / epic.totalStoryPoints) * 100)
    : 0;

  return (
    <div className="main-inner epic-detail">
      <Link
        to={`/${orgSlug}/projects/${projectSlug}/epics`}
        className="epic-detail-back"
      >
        <ChevronLeft size={14} aria-hidden="true" /> Epics
      </Link>

      <header
        className="page-head epic-detail-header"
        style={{ '--epic-color': epic.color || 'var(--accent)' }}
      >
        <div className="eyebrow">{project.name}</div>
        <div className="epic-detail-head-row">
          <span className="epic-detail-color" aria-hidden="true" />
          {editingTitle ? (
            <input
              className="epic-detail-title-input"
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
              className="page-title epic-detail-title epic-detail-title-edit"
              onClick={() => setEditingTitle(true)}
              title="Click to rename"
            >
              {epic.title}
            </button>
          )}
        </div>
        <div className="epic-detail-controls">
          <label className={`epic-detail-status-wrap tone-${STATUS_TONE[epic.status] ?? 'neutral'}`}>
            <select
              className="epic-detail-status"
              value={epic.status}
              onChange={(e) => patch({ status: e.target.value }, 'Could not change status.')}
              aria-label="Epic status"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
              ))}
            </select>
          </label>
          <label className={`epic-detail-risk ${epic.riskFlag ? 'is-on' : ''}`}>
            <input
              type="checkbox"
              className="cb"
              checked={epic.riskFlag}
              onChange={(e) => patch({ riskFlag: e.target.checked }, 'Could not change risk flag.')}
            />
            <span>At risk</span>
          </label>
        </div>
      </header>

      <div className="card epic-detail-progress">
        <div className="epic-detail-kpis">
          <div className="epic-detail-kpi">
            <span className="epic-detail-kpi-value">{pct}%</span>
            <span className="epic-detail-kpi-label">Complete</span>
          </div>
          <div className="epic-detail-kpi">
            <span className="epic-detail-kpi-value">{epic.doneStoryPoints}<span className="epic-detail-kpi-of">/{epic.totalStoryPoints}</span></span>
            <span className="epic-detail-kpi-label">Points done</span>
          </div>
          <div className="epic-detail-kpi">
            <span className="epic-detail-kpi-value">{epic.taskCount}</span>
            <span className="epic-detail-kpi-label">{epic.taskCount === 1 ? 'Task' : 'Tasks'}</span>
          </div>
        </div>
        <div className="epic-detail-bar" aria-label={`Progress ${pct}%`}>
          <div className="epic-detail-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="epic-detail-row">
        <Card className="epic-detail-section">
          <h2 className="epic-detail-heading">Description</h2>
          {editingDesc ? (
            <textarea
              className="epic-detail-desc-input"
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
              className="epic-detail-desc epic-detail-desc-edit"
              onClick={() => setEditingDesc(true)}
              title="Click to edit"
            >
              {epic.description}
            </p>
          ) : (
            <button
              type="button"
              className="epic-detail-desc-empty"
              onClick={() => setEditingDesc(true)}
            >
              Add a description…
            </button>
          )}
        </Card>

        <Card className="epic-detail-section epic-detail-section-meta">
          <div className="epic-detail-field">
            <span className="epic-detail-field-label">Owner</span>
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

          <div className="epic-detail-field">
            <span className="epic-detail-field-label">Color</span>
            <div className="epic-detail-color-grid">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={[
                    'epic-detail-color-swatch',
                    epic.color === c ? 'is-active' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ '--swatch': c }}
                  onClick={() => patch({ color: normalizeColor(c) }, 'Could not change color.')}
                  aria-label={`Set color to ${c}`}
                />
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="epic-detail-section">
        <header className="epic-detail-tasks-head">
          <h2 className="epic-detail-heading">
            Tasks <span className="epic-detail-count">{tasks.length}</span>
          </h2>
          <Button variant="secondary" size="sm" onClick={() => setAiOpen(true)}>
            <Sparkles size={14} aria-hidden="true" /> AI tasks
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

        {tasks.length === 0 ? (
          <p className="epic-detail-placeholder">No tasks in this epic yet.</p>
        ) : (
          <ul className="epic-detail-tasks">
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

        <form className="epic-detail-create" onSubmit={addTaskToEpic}>
          <Plus size={16} aria-hidden="true" className="epic-detail-create-icon" />
          <input
            type="text"
            className="epic-detail-create-input"
            placeholder="Add a task to this epic…"
            aria-label="New task title"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            maxLength={200}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={creating || newTaskTitle.trim().length < 2}
          >
            Add
          </Button>
        </form>
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
      className="epic-detail-task is-interactive"
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
      {task.key && <span className="mono epic-detail-task-key">{task.key}</span>}
      <span className="epic-detail-task-title">{task.title}</span>
      <div className="epic-detail-task-meta">
        <StatusBadge status={task.status} />
        <span className="epic-detail-task-pri"><Priority level={task.priority} showLabel /></span>
        <span className="epic-detail-task-pts">
          {task.storyPoints != null ? `${task.storyPoints} pts` : ''}
        </span>
        <span className="epic-detail-task-avatar">
          {assignee && (
            <Avatar src={assignee.avatarUrl} name={assignee.fullName} size="xs" />
          )}
        </span>
      </div>
    </li>
  );
}
