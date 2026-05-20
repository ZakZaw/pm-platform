import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
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

const BACKLOG_DROP_ID = 'section:backlog';
const sprintDropId = (sprintId) => `section:sprint:${sprintId}`;

export function BacklogPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [backlog, setBacklog] = useState({ sprints: [], unassigned: [] });
  const [epics, setEpics] = useState([]);
  const [error, setError] = useState(null);
  const [openedTaskId, setOpenedTaskId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

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

  async function createTaskInSprint(sprintId, title) {
    const t = (title ?? '').trim();
    if (t.length < 2) return;
    setCreating(true);
    try {
      await tasksApi.create(project.id, { title: t, priority: 'Medium', sprintId });
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

  // Locate the task in the current backlog snapshot. Returns `{ task, source }`
  // where source is either { kind: 'backlog' } or { kind: 'sprint', id }.
  const findTask = useCallback(
    (taskId) => {
      const fromBacklog = backlog.unassigned.find((t) => t.id === taskId);
      if (fromBacklog) return { task: fromBacklog, source: { kind: 'backlog' } };
      for (const s of backlog.sprints ?? []) {
        const found = s.tasks.find((t) => t.id === taskId);
        if (found) return { task: found, source: { kind: 'sprint', id: s.sprintId } };
      }
      return null;
    },
    [backlog],
  );

  function handleDragStart(e) {
    const taskId = String(e.active.id).split(':')[1];
    const hit = findTask(taskId);
    setActiveDrag(hit?.task ?? null);
  }

  async function handleDragEnd(e) {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id).split(':')[1];
    const overId = String(over.id);
    const hit = findTask(taskId);
    if (!hit) return;

    if (overId === BACKLOG_DROP_ID) {
      if (hit.source.kind === 'backlog') return; // no-op
      try {
        await sprintsApi.removeTask(taskId);
        await refresh(project.id);
      } catch (err) {
        toast.show({
          tone: 'danger',
          message: err.response?.data?.detail ?? 'Could not move to backlog.',
        });
      }
      return;
    }

    if (overId.startsWith('section:sprint:')) {
      const targetSprintId = overId.slice('section:sprint:'.length);
      if (hit.source.kind === 'sprint' && hit.source.id === targetSprintId) return;
      try {
        await sprintsApi.addTask(targetSprintId, taskId);
        await refresh(project.id);
      } catch (err) {
        toast.show({
          tone: 'danger',
          message: err.response?.data?.detail ?? 'Could not move to sprint.',
        });
      }
    }
  }

  if (error) return <p className="backlog-page__placeholder">{error}</p>;
  if (!project) return <p className="backlog-page__placeholder">Loading…</p>;

  const totalBacklog = backlog.unassigned?.length ?? 0;

  return (
    <div className="page backlog-page">
      <header className="backlog-page__header">
        <div>
          <h1 className="backlog-page__title">Backlog</h1>
          <p className="backlog-page__subtitle">
            Drag a task into a sprint when it's ready, or back to the backlog to unschedule it.
          </p>
        </div>
      </header>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
          {(backlog.sprints ?? []).map((s) => (
            <SprintSection
              key={s.sprintId}
              section={s}
              memberById={memberById}
              epicById={epicById}
              onOpen={setOpenedTaskId}
              onCreate={createTaskInSprint}
              creating={creating}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null} zIndex={2000}>
          {activeDrag ? (
            <DragRow
              task={activeDrag}
              epic={activeDrag.epicId ? epicById[activeDrag.epicId] : null}
              assignee={activeDrag.assigneeId ? memberById[activeDrag.assigneeId] : null}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

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
  const { setNodeRef, isOver } = useDroppable({ id: BACKLOG_DROP_ID });

  async function submit(e) {
    e.preventDefault();
    await onCreate(newTitle);
    setNewTitle('');
  }

  return (
    <Card
      className={[
        'backlog-page__section',
        'backlog-page__section--primary',
        isOver ? 'is-over' : '',
      ].filter(Boolean).join(' ')}
    >
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

      <div ref={setNodeRef} className="backlog-page__droparea">
        {tasks.length === 0 ? (
          <p className="backlog-page__placeholder">
            {isOver ? 'Drop here to unschedule.' : 'Backlog is empty.'}
          </p>
        ) : (
          <ul className="backlog-page__items">
            {tasks.map((t) => (
              <DraggableRow
                key={t.id}
                task={t}
                assignee={t.assigneeId ? memberById[t.assigneeId] : null}
                epic={t.epicId ? epicById[t.epicId] : null}
                onOpen={onOpen}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function SprintSection({ section, memberById, epicById, onOpen, onCreate, creating }) {
  const { setNodeRef, isOver } = useDroppable({ id: sprintDropId(section.sprintId) });
  const [newTitle, setNewTitle] = useState('');

  async function submit(e) {
    e.preventDefault();
    await onCreate?.(section.sprintId, newTitle);
    setNewTitle('');
  }

  return (
    <Card
      className={['backlog-page__section', isOver ? 'is-over' : ''].filter(Boolean).join(' ')}
    >
      <header className="backlog-page__section-head">
        <h2 className="backlog-page__section-title">{section.name}</h2>
        <Badge tone={section.status === 'Active' ? 'success' : 'neutral'}>{section.status}</Badge>
        <span className="backlog-page__count">
          {section.tasks.length} · {section.donePoints}/{section.totalPoints} pts
        </span>
      </header>

      {section.status !== 'Closed' && (
        <form className="backlog-page__create" onSubmit={submit}>
          <input
            type="text"
            className="backlog-page__create-input"
            placeholder={`Add a task to ${section.name}…`}
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
      )}

      <div ref={setNodeRef} className="backlog-page__droparea">
        {section.tasks.length === 0 ? (
          <p className="backlog-page__placeholder">
            {isOver ? 'Drop here to add to this sprint.' : 'No tasks in this sprint.'}
          </p>
        ) : (
          <ul className="backlog-page__items">
            {section.tasks.map((t) => (
              <DraggableRow
                key={t.id}
                task={t}
                assignee={t.assigneeId ? memberById[t.assigneeId] : null}
                epic={t.epicId ? epicById[t.epicId] : null}
                onOpen={onOpen}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function DraggableRow({ task, assignee, epic, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task:${task.id}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  };
  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.(task.id);
    }
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="backlog-page__item is-interactive"
      role="button"
      tabIndex={0}
      onClick={(e) => {
        // Don't open the drawer when the user clicked the drag handle area
        // mid-drag. dnd-kit will already have intercepted before we get here
        // when the pointer moved beyond the activation threshold.
        if (isDragging) return;
        onOpen?.(task.id);
      }}
      onKeyDown={onKeyDown}
      {...listeners}
      {...attributes}
    >
      <Row task={task} assignee={assignee} epic={epic} />
    </li>
  );
}

function DragRow({ task, assignee, epic }) {
  return (
    <li
      className="backlog-page__item is-overlay"
      style={{ listStyle: 'none', boxShadow: 'var(--shadow-lg)' }}
    >
      <Row task={task} assignee={assignee} epic={epic} />
    </li>
  );
}

function Row({ task, assignee, epic }) {
  return (
    <>
      <span
        className="backlog-page__epic-color"
        style={{ background: epic?.color || 'var(--accent-primary)' }}
        title={epic ? `Epic: ${epic.title}` : 'No epic'}
        aria-hidden="true"
      />
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
      </div>
    </>
  );
}
