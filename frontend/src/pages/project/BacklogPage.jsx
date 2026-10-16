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
import { ChevronRight, ListChecks, Plus, Sparkles } from 'lucide-react';
import { Avatar, Button, Card, Priority, Skeleton, useToast } from '@/components/ui';
import { AITaskListWizardModal } from '@/components/ai/AITaskListWizardModal';
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
  const [aiOpen, setAiOpen] = useState(false);

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

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!project) {
    return (
      <div className="main-inner backlog-page" aria-busy="true">
        <div className="page-head">
          <div className="page-title-row">
            <h1 className="page-title">Backlog</h1>
          </div>
        </div>
        <div className="backlog-page-sections">
          <Card className="backlog-page-skeleton">
            <Skeleton width="40%" height={16} />
            <Skeleton rows={5} />
          </Card>
        </div>
      </div>
    );
  }

  const totalBacklog = backlog.unassigned?.length ?? 0;

  return (
    <div className="main-inner backlog-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow">{project.name}</div>
            <h1 className="page-title">Backlog</h1>
            <div className="page-subtitle">
              Drag a task into a sprint when it's ready, or back to the backlog to unschedule it.
            </div>
          </div>
          <div className="row gap-2">
            <Button variant="ai" onClick={() => setAiOpen(true)}>
              <Sparkles size={13} aria-hidden="true" /> AI tasks
            </Button>
          </div>
        </div>
      </div>

      <AITaskListWizardModal
        open={aiOpen}
        projectId={project.id}
        epicOptions={epics
          .filter((e) => !e.archivedAt)
          .map((e) => ({ value: e.id, label: e.title }))}
        onClose={() => setAiOpen(false)}
        onCreated={() => {
          setAiOpen(false);
          refresh(project.id).catch(() => {});
        }}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="backlog-page-sections">
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

/** Quiet inline "add a task" field — the Add button appears once you type. */
function QuickAdd({ placeholder, creating, onSubmit }) {
  const [title, setTitle] = useState('');
  async function submit(e) {
    e.preventDefault();
    await onSubmit(title);
    setTitle('');
  }
  const typed = title.trim().length > 0;
  return (
    <form className="backlog-page-create" onSubmit={submit}>
      <Plus size={16} aria-hidden="true" className="backlog-page-create-icon" />
      <input
        type="text"
        className="backlog-page-create-input"
        placeholder={placeholder}
        aria-label={placeholder.replace(/…$/, '')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />
      {typed && (
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={creating || title.trim().length < 2}
        >
          Add
        </Button>
      )}
    </form>
  );
}

function TaskList({ tasks, memberById, epicById, onOpen }) {
  return (
    <ul className="backlog-page-items">
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
  );
}

function BacklogSection({ tasks, memberById, epicById, onOpen, onCreate, creating, count }) {
  const { setNodeRef, isOver } = useDroppable({ id: BACKLOG_DROP_ID });

  return (
    <section
      ref={setNodeRef}
      className={['card', 'backlog-page-section', isOver ? 'is-over' : ''].filter(Boolean).join(' ')}
    >
      <header className="backlog-page-section-head">
        <h2 className="backlog-page-section-title">Backlog</h2>
        <span className="backlog-page-count">{count} task{count === 1 ? '' : 's'}</span>
      </header>

      <QuickAdd placeholder="Add a task to the backlog…" creating={creating} onSubmit={onCreate} />

      {tasks.length === 0 ? (
        <p className="backlog-page-placeholder">
          {isOver ? 'Drop here to unschedule.' : 'Backlog is empty.'}
        </p>
      ) : (
        <TaskList tasks={tasks} memberById={memberById} epicById={epicById} onOpen={onOpen} />
      )}
    </section>
  );
}

const SPRINT_STATUS_CLASS = { Active: 'status-progress', Planning: 'status-todo', Closed: 'status-done' };

function SprintSection({ section, memberById, epicById, onOpen, onCreate, creating }) {
  const { setNodeRef, isOver } = useDroppable({ id: sprintDropId(section.sprintId) });
  // Closed sprints are history — fold them by default so live work leads.
  const [open, setOpen] = useState(section.status !== 'Closed');
  const bodyId = `backlog-sprint-${section.sprintId}`;
  const count = section.tasks.length;

  return (
    <section
      ref={setNodeRef}
      className={[
        'card',
        'backlog-page-section',
        open ? '' : 'is-collapsed',
        isOver ? 'is-over' : '',
      ].filter(Boolean).join(' ')}
    >
      <header className="backlog-page-section-head">
        <button
          type="button"
          className="backlog-page-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
        >
          <ChevronRight size={16} aria-hidden="true" className="backlog-page-chevron" />
          <h2 className="backlog-page-section-title">{section.name}</h2>
        </button>
        <span className={`status ${SPRINT_STATUS_CLASS[section.status] ?? 'status-todo'}`}>
          {section.status}
        </span>
        <span className="backlog-page-count">
          {count} task{count === 1 ? '' : 's'} · {section.donePoints}/{section.totalPoints} pts
        </span>
      </header>

      {open && (
        <div id={bodyId} className="backlog-page-section-body">
          {section.status !== 'Closed' && (
            <QuickAdd
              placeholder={`Add a task to ${section.name}…`}
              creating={creating}
              onSubmit={(title) => onCreate?.(section.sprintId, title)}
            />
          )}
          {count === 0 ? (
            <p className="backlog-page-placeholder">
              {isOver ? 'Drop here to add to this sprint.' : 'No tasks in this sprint.'}
            </p>
          ) : (
            <TaskList tasks={section.tasks} memberById={memberById} epicById={epicById} onOpen={onOpen} />
          )}
        </div>
      )}
      {!open && isOver && (
        <p className="backlog-page-placeholder">Drop here to add to this sprint.</p>
      )}
    </section>
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
      className="backlog-page-item is-interactive"
      role="button"
      tabIndex={0}
      onClick={() => {
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
    <div className="backlog-page-item is-overlay">
      <Row task={task} assignee={assignee} epic={epic} />
    </div>
  );
}

function Row({ task, assignee, epic }) {
  return (
    <>
      <span className="backlog-page-item-title">{task.title}</span>
      <div className="backlog-page-item-meta">
        {/* Fixed meta columns keep rows aligned; empty slots render blank. */}
        {epic ? (
          <span
            className="backlog-page-epic"
            // Epic colour is user data — passed as a custom property.
            style={epic.color ? { '--epic-color': epic.color } : undefined}
            title={`Epic: ${epic.title}`}
          >
            <span className="truncate">{epic.title}</span>
          </span>
        ) : <span className="backlog-page-epic" />}
        <Priority level={task.priority} showLabel />
        <span className="backlog-page-pts">
          {task.storyPoints != null ? `${task.storyPoints} pts` : ''}
        </span>
        {task.subtaskCount > 0 ? (
          <span className="backlog-page-subtasks" title="Subtasks done">
            <ListChecks size={13} aria-hidden="true" />
            {task.completedSubtaskCount}/{task.subtaskCount}
          </span>
        ) : <span className="backlog-page-subtasks" />}
        {assignee ? (
          <Avatar src={assignee.avatarUrl} name={assignee.fullName} size="xs" />
        ) : (
          <span className="backlog-page-unassigned" title="Unassigned" aria-label="Unassigned" />
        )}
      </div>
    </>
  );
}
