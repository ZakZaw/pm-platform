import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal } from 'lucide-react';
import {
  Avatar,
  Badge,
  Priority,
  Select,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import { usersApi } from '@/api/users.api';
import { sprintsApi } from '@/api/sprints.api';
import { myWorkApi } from '@/api/myWork.api';
import { tasksApi } from '@/api/tasks.api';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import '@/components/kanban/KanbanCard.css';
import '@/components/kanban/KanbanColumn.css';
import './MyWorkPage.css';

const COLUMN_ORDER = ['Backlog', 'ToDo', 'InProgress', 'InReview', 'Blocked'];

const ALL = '__all__';

function shortKey(item) {
  // item.key is "AT-247" style, composed server-side from
  // project.Key + task.KeyNum.
  if (item.key) return item.key;
  const id = String(item.id ?? '');
  return id ? id.slice(0, 4).toUpperCase() : '—';
}

export function MyWorkPage() {
  const user = useAuthStore((s) => s.user);
  const orgs = useOrgStore((s) => s.orgs);
  const projectsByOrg = useProjectStore((s) => s.byOrg);
  const refreshProjectsForOrg = useProjectStore((s) => s.refreshForOrg);
  const toast = useToast();

  const [personalProject, setPersonalProject] = useState(null);
  const [items, setItems] = useState([]);
  const [activeSprints, setActiveSprints] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [projectFilter, setProjectFilter] = useState(ALL);
  const [sprintFilter, setSprintFilter] = useState(ALL);
  const [opened, setOpened] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await usersApi.personalProject().catch(() => null);
      if (!cancelled) setPersonalProject(p);
      for (const o of orgs) {
        if (!projectsByOrg[o.slug]) refreshProjectsForOrg(o.slug).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [orgs, projectsByOrg, refreshProjectsForOrg]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sprints = [];
      for (const o of orgs) {
        const list = projectsByOrg[o.slug] ?? [];
        for (const p of list) {
          try {
            const s = await sprintsApi.getActive(p.id);
            if (s && !cancelled) sprints.push({ ...s, projectName: p.name });
          } catch {
            /* viewer might not be a project member */
          }
        }
      }
      if (!cancelled) setActiveSprints(sprints);
    })();
    return () => { cancelled = true; };
  }, [orgs, projectsByOrg]);

  const refresh = useCallback(async () => {
    const params = {};
    if (projectFilter !== ALL) params.projectId = projectFilter;
    if (sprintFilter !== ALL) params.sprintId = sprintFilter;
    const data = await myWorkApi.list(params);
    setItems(data);
  }, [projectFilter, sprintFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load your tasks.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const projectOptions = useMemo(() => {
    const opts = [{ value: ALL, label: 'All projects' }];
    if (personalProject) opts.push({ value: personalProject.id, label: 'Personal' });
    for (const o of orgs) {
      for (const p of projectsByOrg[o.slug] ?? []) {
        opts.push({ value: p.id, label: `${o.name} · ${p.name}` });
      }
    }
    return opts;
  }, [personalProject, orgs, projectsByOrg]);

  const sprintOptions = useMemo(() => {
    const opts = [{ value: ALL, label: 'All sprints' }];
    for (const s of activeSprints) {
      opts.push({ value: s.id, label: `${s.projectName} · ${s.name}` });
    }
    return opts;
  }, [activeSprints]);

  const columns = useMemo(() => groupByStatus(items), [items]);
  const totalOpen = items.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  async function handleDragEnd(e) {
    const { active, over } = e;
    if (!over) return;
    const taskId = parseCardId(String(active.id));
    const targetStatus = parseColumnId(String(over.id));
    if (!taskId || !targetStatus) return;

    const current = items.find((it) => it.id === taskId);
    if (!current || current.status === targetStatus) return;

    const before = items;
    setItems((cur) =>
      cur.map((it) => (it.id === taskId ? { ...it, status: targetStatus } : it)),
    );

    try {
      await tasksApi.changeStatus(taskId, { to: targetStatus });
    } catch (err) {
      setItems(before);
      toast.show({
        tone: 'danger',
        title: 'Could not move task',
        message: err.response?.data?.detail ?? 'Server rejected the transition.',
      });
    }
  }

  return (
    <div className="mywork">
      <header className="page-header mywork__header">
        <div className="grow">
          <div className="hstack" style={{ gap: 8 }}>
            <div className="page-title">My work</div>
            <Badge tone="neutral">{totalOpen} open</Badge>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {user?.fullName ? `${user.fullName}'s tasks across every project.` : 'Tasks assigned to you across every project.'}
          </div>
        </div>
        <div className="hstack mywork__filters">
          <Select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            options={projectOptions}
            aria-label="Filter by project"
          />
          <Select
            value={sprintFilter}
            onChange={(e) => setSprintFilter(e.target.value)}
            options={sprintOptions}
            aria-label="Filter by sprint"
          />
        </div>
      </header>

      {loading && <p className="mywork__placeholder">Loading…</p>}
      {error && <p className="mywork__placeholder">{error}</p>}

      {!loading && !error && (
        <div className="mywork__board-wrap">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="kanban__columns mywork__columns">
              {COLUMN_ORDER.map((status) => (
                <MyWorkColumn
                  key={status}
                  status={status}
                  items={columns[status] ?? []}
                  onOpen={(item) => setOpened({ taskId: item.id, projectId: item.projectId })}
                />
              ))}
            </div>
          </DndContext>
        </div>
      )}

      <TaskDetailDrawer
        taskId={opened?.taskId ?? null}
        projectId={opened?.projectId ?? null}
        onClose={() => setOpened(null)}
        onChanged={() => refresh().catch(() => {})}
      />
    </div>
  );
}

function groupByStatus(items) {
  const map = {};
  for (const status of COLUMN_ORDER) map[status] = [];
  for (const item of items) {
    if (!map[item.status]) map[item.status] = [];
    map[item.status].push(item);
  }
  return map;
}

function MyWorkColumn({ status, items, onOpen }) {
  const { isOver, setNodeRef } = useDroppable({ id: `mw-col:${status}` });
  const pts = items.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={['kanban-col', isOver ? 'is-over' : ''].filter(Boolean).join(' ')}
    >
      <header className="hstack kanban-col__head">
        <div className="hstack" style={{ gap: 8 }}>
          <StatusBadge status={status} />
          <span className="mono dim kanban-col__count">
            {items.length}
            {pts > 0 && ` · ${pts}pt`}
          </span>
        </div>
        <span className="icon-btn icon-btn-sm" aria-hidden="true">
          <MoreHorizontal size={12} />
        </span>
      </header>
      <div className="kanban-col__body">
        {items.length === 0 ? (
          <p className="mywork__empty">No tasks here.</p>
        ) : (
          items.map((item) => <ItemCard key={item.id} item={item} onOpen={onOpen} />)
        )}
      </div>
    </div>
  );
}

function ItemCard({ item, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `mw-card:${item.id}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };

  function handleClick() {
    if (isDragging) return;
    onOpen?.(item);
  }
  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.(item);
    }
  }

  const assigneeName =
    item.assigneeName ?? (item.assigneeId ? '—' : null);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      onKeyDown={handleKey}
      className="card kanban-card mywork__card"
      role="button"
      tabIndex={0}
      aria-label={`${item.title} — ${item.priority} priority`}
    >
      <div className="hstack kanban-card__top">
        <span className="mono dim kanban-card__key">{shortKey(item)}</span>
        <Priority level={item.priority} />
      </div>

      <div className="kanban-card__title">{item.title}</div>

      <div className="hstack mywork__project-row">
        <span className="truncate">
          {item.projectIsPersonal ? 'Personal' : item.projectName}
        </span>
        {item.dueDate && (
          <span className="mono dim mywork__due">{formatDue(item.dueDate)}</span>
        )}
      </div>

      <div className="hstack kanban-card__foot">
        {assigneeName ? (
          <Avatar name={assigneeName} size="xs" />
        ) : (
          <span className="kanban-card__unassigned" title="Unassigned" />
        )}
        {item.storyPoints != null && (
          <span className="mono kanban-card__pts" title="Story points">
            {item.storyPoints}
          </span>
        )}
      </div>
    </div>
  );
}

function parseCardId(id) {
  const parts = id.split(':');
  return parts[0] === 'mw-card' ? parts[1] : null;
}
function parseColumnId(id) {
  const parts = id.split(':');
  return parts[0] === 'mw-col' ? parts[1] : null;
}
function formatDue(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
