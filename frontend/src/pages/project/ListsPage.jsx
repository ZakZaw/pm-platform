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
import { ListTodo, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  Skeleton,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { listsApi } from '@/api/lists.api';
import { tasksApi } from '@/api/tasks.api';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import './ListsPage.css';

const UNSORTED_DROP_ID = 'list:unsorted';
const listDropId = (id) => `list:${id}`;
const listDragId = (id) => `list-handle:${id}`;
const taskDragId = (id) => `task:${id}`;

// The ListsPage is the only project view for Generic projects (CLAUDE.md
// project-types section). It works without epics, sprints, or AC — just
// drag tasks between lists and reorder the lists themselves.
export function ListsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [view, setView] = useState(null); // { lists, unsorted }
  const [error, setError] = useState(null);
  const [creatingList, setCreatingList] = useState(false);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null); // { kind: 'task'|'list', item }
  const [editingListId, setEditingListId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const { members } = useOrgMembers(orgSlug);
  const memberById = useMemo(() => {
    const m = {};
    for (const x of members) m[x.userId] = x;
    return m;
  }, [members]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const refresh = useCallback(async (projectId) => {
    const v = await listsApi.getView(projectId);
    setView(v);
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
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load lists.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, refresh]);

  async function createList(name) {
    const n = (name ?? '').trim();
    if (n.length < 1) return;
    try {
      await listsApi.createList(project.id, n);
      await refresh(project.id);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not create list.' });
    }
  }

  async function renameList(listId, name) {
    const n = (name ?? '').trim();
    if (n.length < 1) return;
    try {
      await listsApi.updateList(listId, { name: n });
      await refresh(project.id);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not rename list.' });
    }
  }

  async function deleteList(listId) {
    try {
      await listsApi.deleteList(listId);
      setConfirmDeleteId(null);
      await refresh(project.id);
      toast.show({ tone: 'success', message: 'List deleted. Tasks were moved to Unsorted.' });
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not delete list.' });
    }
  }

  async function createTask(listId, title) {
    const t = (title ?? '').trim();
    if (t.length < 2) return;
    try {
      await tasksApi.create(project.id, { title: t, priority: 'Medium', taskListId: listId });
      await refresh(project.id);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not create task.' });
    }
  }

  // Resolves a drag id back to its item — either a task or a list handle.
  const findDragItem = useCallback(
    (id) => {
      const s = String(id);
      if (s.startsWith('task:')) {
        const taskId = s.slice('task:'.length);
        const fromUnsorted = view?.unsorted?.find((t) => t.id === taskId);
        if (fromUnsorted) return { kind: 'task', item: fromUnsorted };
        for (const l of view?.lists ?? []) {
          const found = l.tasks.find((t) => t.id === taskId);
          if (found) return { kind: 'task', item: found };
        }
        return null;
      }
      if (s.startsWith('list-handle:')) {
        const listId = s.slice('list-handle:'.length);
        const l = view?.lists?.find((x) => x.id === listId);
        return l ? { kind: 'list', item: l } : null;
      }
      return null;
    },
    [view],
  );

  function handleDragStart(e) {
    setActiveDrag(findDragItem(e.active.id));
  }

  async function handleDragEnd(e) {
    const drag = activeDrag;
    setActiveDrag(null);
    const { active, over } = e;
    if (!over || !drag || !project) return;
    const overId = String(over.id);

    // List reordering — we only honor drops onto another list's handle.
    if (drag.kind === 'list') {
      if (!overId.startsWith('list-handle:')) return;
      const targetId = overId.slice('list-handle:'.length);
      if (targetId === drag.item.id) return;
      const ordered = view.lists.map((l) => l.id);
      const fromIdx = ordered.indexOf(drag.item.id);
      const toIdx = ordered.indexOf(targetId);
      if (fromIdx < 0 || toIdx < 0) return;
      ordered.splice(fromIdx, 1);
      ordered.splice(toIdx, 0, drag.item.id);
      // Optimistic
      setView({
        ...view,
        lists: ordered.map((id) => view.lists.find((l) => l.id === id)),
      });
      try {
        await listsApi.reorder(project.id, ordered);
        await refresh(project.id);
      } catch (err) {
        toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not reorder lists.' });
        await refresh(project.id);
      }
      return;
    }

    // Task move between lists.
    if (drag.kind === 'task') {
      let targetListId;
      if (overId === UNSORTED_DROP_ID) targetListId = null;
      else if (overId.startsWith('list:')) targetListId = overId.slice('list:'.length);
      else return;

      const currentListId = drag.item.id
        && (view.lists.find((l) => l.tasks.some((t) => t.id === drag.item.id))?.id ?? null);
      if (currentListId === targetListId) return;

      try {
        await listsApi.moveTaskToList(drag.item.id, targetListId);
        await refresh(project.id);
      } catch (err) {
        toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not move task.' });
      }
    }
  }

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!project || !view) {
    return (
      <div className="main-inner lists-page" aria-busy="true">
        <div className="page-head">
          <Skeleton width="30%" height={28} />
        </div>
        <div className="col gap-4">
          {[0, 1].map((i) => <Skeleton key={i} height={120} radius="lg" />)}
        </div>
      </div>
    );
  }

  const totalTasks =
    view.unsorted.length + view.lists.reduce((acc, l) => acc + l.tasks.length, 0);

  return (
    <div className="main-inner lists-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{project.name} · Lists</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>Lists</h1>
            <p className="page-subtitle" style={{ marginTop: 6 }}>
              {totalTasks} task{totalTasks === 1 ? '' : 's'} across {view.lists.length} list{view.lists.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="row gap-3">
            <NewListButton creating={creatingList} setCreating={setCreatingList} onSubmit={createList} />
          </div>
        </div>
      </div>

      {view.lists.length === 0 && view.unsorted.length === 0 ? (
        <EmptyState
          icon={<ListTodo size={20} aria-hidden="true" />}
          title="No lists yet"
          subtitle="Group tasks by phase, area, or status — whatever fits this project."
        >
          <Button onClick={() => setCreatingList(true)}>Create your first list</Button>
        </EmptyState>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="lists-page__stack">
            {view.lists.map((l) => (
              <ListSection
                key={l.id}
                list={l}
                memberById={memberById}
                isEditing={editingListId === l.id}
                onStartEdit={() => setEditingListId(l.id)}
                onSubmitRename={async (name) => {
                  setEditingListId(null);
                  if (name && name !== l.name) await renameList(l.id, name);
                }}
                onCancelRename={() => setEditingListId(null)}
                onRequestDelete={() => setConfirmDeleteId(l.id)}
                onCreateTask={(title) => createTask(l.id, title)}
                onOpenTask={setOpenTaskId}
              />
            ))}
            <UnsortedSection
              tasks={view.unsorted}
              memberById={memberById}
              onCreateTask={(title) => createTask(null, title)}
              onOpenTask={setOpenTaskId}
            />
          </div>

          <DragOverlay dropAnimation={null} zIndex={2000}>
            {activeDrag?.kind === 'task' ? (
              <DragTaskRow
                task={activeDrag.item}
                assignee={activeDrag.item.assigneeId ? memberById[activeDrag.item.assigneeId] : null}
              />
            ) : activeDrag?.kind === 'list' ? (
              <div className="lists-page__list-overlay">
                <span className="lists-page__list-title">{activeDrag.item.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Delete this list?"
        message="Tasks in the list aren't deleted — they move to Unsorted."
        confirmLabel="Delete list"
        tone="danger"
        onConfirm={() => deleteList(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <TaskDetailDrawer
        taskId={openTaskId}
        projectId={project.id}
        onClose={() => setOpenTaskId(null)}
        onChanged={() => refresh(project.id).catch(() => {})}
      />
    </div>
  );
}

function NewListButton({ creating, setCreating, onSubmit }) {
  const [name, setName] = useState('');
  if (!creating) {
    return (
      <Button size="sm" onClick={() => setCreating(true)}>
        <Plus size={13} aria-hidden="true" /> New list
      </Button>
    );
  }
  return (
    <form
      className="hstack lists-page__newlist"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name);
        setName('');
        setCreating(false);
      }}
    >
      <input
        autoFocus
        className="lists-page__newlist-input"
        placeholder="List name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setCreating(false); setName(''); }
        }}
      />
      <Button type="submit" size="sm" disabled={name.trim().length === 0}>Add</Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => { setCreating(false); setName(''); }}
      >Cancel</Button>
    </form>
  );
}

function ListSection({
  list,
  memberById,
  isEditing,
  onStartEdit,
  onSubmitRename,
  onCancelRename,
  onRequestDelete,
  onCreateTask,
  onOpenTask,
}) {
  const [newTitle, setNewTitle] = useState('');
  const [draftName, setDraftName] = useState(list.name);
  const { setNodeRef, isOver } = useDroppable({ id: listDropId(list.id) });

  useEffect(() => { if (isEditing) setDraftName(list.name); }, [isEditing, list.name]);

  // Separate draggable handle for reordering the list itself.
  const { attributes, listeners, setNodeRef: setHandleRef, transform, isDragging } = useDraggable({
    id: listDragId(list.id),
  });
  const handleStyle = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  async function submitTask(e) {
    e.preventDefault();
    await onCreateTask(newTitle);
    setNewTitle('');
  }

  const doneCount = list.tasks.filter((t) => t.status === 'Done').length;

  return (
    <Card className={['lists-page__list', isOver ? 'is-over' : ''].filter(Boolean).join(' ')}>
      <header
        ref={setHandleRef}
        className="lists-page__list-head"
        style={handleStyle}
        {...attributes}
        {...listeners}
      >
        {isEditing ? (
          <form
            className="hstack grow"
            onSubmit={(e) => { e.preventDefault(); onSubmitRename(draftName.trim()); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              className="lists-page__rename-input"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => onSubmitRename(draftName.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); onCancelRename(); }
              }}
              maxLength={120}
            />
          </form>
        ) : (
          <>
            <h2 className="lists-page__list-title">{list.name}</h2>
            <span className="muted lists-page__list-count">
              {doneCount}/{list.tasks.length}
            </span>
            <div className="grow" />
            <Dropdown
              align="end"
              trigger={
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  aria-label="List options"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal size={14} aria-hidden="true" />
                </button>
              }
            >
              <Dropdown.Item icon={<Pencil size={13} aria-hidden="true" />} onSelect={onStartEdit}>
                Rename
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item
                icon={<Trash2 size={13} aria-hidden="true" />}
                danger
                onSelect={onRequestDelete}
              >
                Delete list
              </Dropdown.Item>
            </Dropdown>
          </>
        )}
      </header>

      <form className="lists-page__create" onSubmit={submitTask}>
        <input
          type="text"
          className="lists-page__create-input"
          placeholder="Add a task…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          maxLength={200}
        />
        <Button type="submit" size="sm" disabled={newTitle.trim().length < 2}>
          <Plus size={13} aria-hidden="true" /> Add
        </Button>
      </form>

      <div ref={setNodeRef} className="lists-page__droparea">
        {list.tasks.length === 0 ? (
          <p className="lists-page__placeholder">
            {isOver ? 'Drop here to add to this list.' : 'No tasks yet.'}
          </p>
        ) : (
          <ul className="lists-page__items">
            {list.tasks.map((t) => (
              <DraggableTaskRow
                key={t.id}
                task={t}
                assignee={t.assigneeId ? memberById[t.assigneeId] : null}
                onOpen={onOpenTask}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function UnsortedSection({ tasks, memberById, onCreateTask, onOpenTask }) {
  const [newTitle, setNewTitle] = useState('');
  const { setNodeRef, isOver } = useDroppable({ id: UNSORTED_DROP_ID });

  async function submit(e) {
    e.preventDefault();
    await onCreateTask(newTitle);
    setNewTitle('');
  }

  return (
    <Card className={['lists-page__list', 'lists-page__list--unsorted', isOver ? 'is-over' : ''].filter(Boolean).join(' ')}>
      <header className="lists-page__list-head lists-page__list-head--static">
        <h2 className="lists-page__list-title">Unsorted</h2>
        <span className="muted lists-page__list-count">{tasks.length}</span>
      </header>
      <form className="lists-page__create" onSubmit={submit}>
        <input
          type="text"
          className="lists-page__create-input"
          placeholder="Add a task to Unsorted…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          maxLength={200}
        />
        <Button type="submit" size="sm" disabled={newTitle.trim().length < 2}>
          <Plus size={13} aria-hidden="true" /> Add
        </Button>
      </form>
      <div ref={setNodeRef} className="lists-page__droparea">
        {tasks.length === 0 ? (
          <p className="lists-page__placeholder">
            {isOver ? 'Drop here to move out of any list.' : 'No unsorted tasks.'}
          </p>
        ) : (
          <ul className="lists-page__items">
            {tasks.map((t) => (
              <DraggableTaskRow
                key={t.id}
                task={t}
                assignee={t.assigneeId ? memberById[t.assigneeId] : null}
                onOpen={onOpenTask}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function DraggableTaskRow({ task, assignee, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: taskDragId(task.id),
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="lists-page__item is-interactive"
      role="button"
      tabIndex={0}
      onClick={() => { if (!isDragging) onOpen?.(task.id); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(task.id); }
      }}
      {...listeners}
      {...attributes}
    >
      <TaskRow task={task} assignee={assignee} />
    </li>
  );
}

function DragTaskRow({ task, assignee }) {
  return (
    <li
      className="lists-page__item is-overlay"
      style={{ listStyle: 'none', boxShadow: 'var(--shadow-lg)' }}
    >
      <TaskRow task={task} assignee={assignee} />
    </li>
  );
}

function TaskRow({ task, assignee }) {
  return (
    <>
      <StatusBadge status={task.status} />
      <span className="lists-page__item-title">{task.title}</span>
      <span className="muted lists-page__item-key mono">{task.key}</span>
      <div className="lists-page__item-meta">
        <Badge tone="info">{task.priority}</Badge>
        {task.subtaskCount > 0 && (
          <span className="lists-page__item-sub">
            {task.completedSubtaskCount}/{task.subtaskCount}
          </span>
        )}
        {task.dueDate && (
          <span className="muted" style={{ fontSize: 11 }}>
            Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
        {assignee ? (
          <Avatar src={assignee.avatarUrl} name={assignee.fullName} size="xs" />
        ) : (
          <span className="lists-page__unassigned" title="Unassigned" />
        )}
      </div>
    </>
  );
}
