import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Avatar, Badge, Button, Card, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { boardApi } from '@/api/board.api';
import { sprintsApi } from '@/api/sprints.api';
import { epicsApi } from '@/api/epics.api';
import { tasksApi } from '@/api/tasks.api';
import { useProjectHub } from '@/hooks/useProjectHub';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import './BacklogPage.css';

export function BacklogPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [backlog, setBacklog] = useState({ sprints: [], unassigned: [] });
  const [epics, setEpics] = useState([]);
  const [error, setError] = useState(null);
  const [openedTaskId, setOpenedTaskId] = useState(null);
  const [creating, setCreating] = useState(false);

  const { members } = useOrgMembers(orgSlug);
  const memberById = useMemo(() => {
    const map = {};
    for (const m of members) map[m.userId] = m;
    return map;
  }, [members]);
  const epicById = useMemo(() => {
    const map = {};
    for (const e of epics) map[e.id] = e;
    return map;
  }, [epics]);

  const refresh = useCallback(async (projectId) => {
    const [bl, eps] = await Promise.all([
      boardApi.backlog(projectId),
      epicsApi.listForProject(projectId),
    ]);
    setBacklog(bl);
    setEpics(eps);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load backlog.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, refresh]);

  useProjectHub(project?.id, (name) => {
    if (name === 'board.changed' || name === 'sprint.changed') {
      refresh(project.id).catch(() => {});
    }
  });

  async function removeFromSprint(taskId) {
    try {
      await sprintsApi.removeTask(taskId);
      await refresh(project.id);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not remove from sprint.',
      });
    }
  }

  async function createTask(title) {
    const t = (title ?? '').trim();
    if (t.length < 2) return;
    setCreating(true);
    try {
      await tasksApi.create(project.id, { title: t, priority: 'Medium' });
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

  if (error) return <p className="backlog-page__placeholder">{error}</p>;
  if (!project) return <p className="backlog-page__placeholder">Loading…</p>;

  const totalBacklog = backlog.unassigned?.length ?? 0;

  return (
    <div className="backlog-page">
      <header className="backlog-page__header">
        <div>
          <h1 className="backlog-page__title">Backlog</h1>
          <p className="backlog-page__subtitle">
            Unscheduled tasks come first. Add them to a sprint when you're ready.
          </p>
        </div>
      </header>

      <div className="backlog-page__sections">
        <BacklogSection
          tasks={backlog.unassigned}
          memberById={memberById}
          epicById={epicById}
          onOpen={setOpenedTaskId}
          onCreate={createTask}
          creating={creating}
          count={totalBacklog}
        />
        {backlog.sprints.map((s) => (
          <SprintSection
            key={s.sprintId}
            section={s}
            memberById={memberById}
            epicById={epicById}
            onRemove={removeFromSprint}
            onOpen={setOpenedTaskId}
          />
        ))}
      </div>

      <TaskDetailDrawer
        taskId={openedTaskId}
        projectId={project.id}
        onClose={() => setOpenedTaskId(null)}
        onChanged={() => refresh(project.id)}
      />
    </div>
  );
}

function BacklogSection({ tasks, memberById, epicById, onOpen, onCreate, creating, count }) {
  const [newTitle, setNewTitle] = useState('');

  async function submit(e) {
    e.preventDefault();
    await onCreate(newTitle);
    setNewTitle('');
  }

  return (
    <Card className="backlog-page__section backlog-page__section--primary">
      <header className="backlog-page__section-head">
        <h2 className="backlog-page__section-title">Backlog</h2>
        <span className="backlog-page__count">{count} tasks</span>
      </header>

      <form className="backlog-page__create" onSubmit={submit}>
        <input
          type="text"
          className="backlog-page__create-input"
          placeholder="Add a task to the backlog…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          maxLength={200}
        />
        <Button
          type="submit"
          size="sm"
          disabled={creating || newTitle.trim().length < 2}
        >
          <Plus size={14} aria-hidden="true" /> Add
        </Button>
      </form>

      {tasks.length === 0 ? (
        <p className="backlog-page__placeholder">Backlog is empty.</p>
      ) : (
        <ul className="backlog-page__items">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              assignee={t.assigneeId ? memberById[t.assigneeId] : null}
              epic={t.epicId ? epicById[t.epicId] : null}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function SprintSection({ section, memberById, epicById, onRemove, onOpen }) {
  return (
    <Card className="backlog-page__section">
      <header className="backlog-page__section-head">
        <h2 className="backlog-page__section-title">{section.name}</h2>
        <Badge tone={section.status === 'Active' ? 'success' : 'neutral'}>{section.status}</Badge>
        <span className="backlog-page__count">
          {section.tasks.length} · {section.donePoints}/{section.totalPoints} pts
        </span>
      </header>
      {section.goal && <p className="backlog-page__sprint-goal">{section.goal}</p>}
      {section.tasks.length === 0 ? (
        <p className="backlog-page__placeholder">No tasks in this sprint.</p>
      ) : (
        <ul className="backlog-page__items">
          {section.tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              assignee={t.assigneeId ? memberById[t.assigneeId] : null}
              epic={t.epicId ? epicById[t.epicId] : null}
              onOpen={onOpen}
              right={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
                >
                  Remove
                </Button>
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function TaskRow({ task, assignee, epic, right, onOpen }) {
  return (
    <li
      className="backlog-page__item is-interactive"
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
      {epic && (
        <span
          className="backlog-page__epic-color"
          style={{ background: epic.color || 'var(--accent-primary)' }}
          title={epic.title}
          aria-label={`Epic: ${epic.title}`}
        />
      )}
      <span className="backlog-page__item-title">{task.title}</span>
      <div className="backlog-page__item-meta">
        {epic && <Badge tone="neutral">{epic.title}</Badge>}
        <Badge tone="info">{task.priority}</Badge>
        {task.storyPoints != null && <Badge tone="purple">{task.storyPoints} pts</Badge>}
        {task.subtaskCount > 0 && (
          <span className="backlog-page__subtasks">
            {task.completedSubtaskCount}/{task.subtaskCount}
          </span>
        )}
        {assignee ? (
          <Avatar src={assignee.avatarUrl} name={assignee.fullName} size="xs" />
        ) : (
          <span className="backlog-page__unassigned" title="Unassigned" />
        )}
        {right}
      </div>
    </li>
  );
}
