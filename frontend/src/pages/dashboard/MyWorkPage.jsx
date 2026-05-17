import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge, Card, Select, StatusBadge, useToast } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import { usersApi } from '@/api/users.api';
import { sprintsApi } from '@/api/sprints.api';
import { myWorkApi } from '@/api/myWork.api';
import { tasksApi } from '@/api/tasks.api';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import './MyWorkPage.css';

const COLUMN_ORDER = ['Backlog', 'ToDo', 'InProgress', 'InReview', 'Blocked'];

const PRIORITY_TONE = {
  Urgent: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
};

const ALL = '__all__';

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
            /* skip — viewer might not be a project member */
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

    // Optimistic move
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
      <header className="mywork__head">
        <div>
          <h1 className="mywork__title">My work</h1>
          <p className="mywork__subtitle">
            {user?.fullName ? `Welcome, ${user.fullName}. ` : ''}
            Tasks assigned to you across every project.
          </p>
        </div>
        <div className="mywork__filters">
          <Select
            label="Project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            options={projectOptions}
          />
          <Select
            label="Sprint"
            value={sprintFilter}
            onChange={(e) => setSprintFilter(e.target.value)}
            options={sprintOptions}
          />
        </div>
      </header>

      {loading && <p className="mywork__placeholder">Loading…</p>}
      {error && <p className="mywork__placeholder">{error}</p>}

      {!loading && !error && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="mywork__board">
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
  return (
    <div
      ref={setNodeRef}
      className={['mywork__col', isOver ? 'is-over' : ''].filter(Boolean).join(' ')}
    >
      <header className="mywork__col-head">
        <StatusBadge status={status} />
        <span className="mywork__col-count">{items.length}</span>
      </header>
      <div className="mywork__col-body">
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      className="mywork__card-button"
      onClick={handleClick}
      onKeyDown={handleKey}
    >
      <Card className="mywork__card">
        <div className="mywork__card-title">{item.title}</div>
        <div className="mywork__card-meta">
          <Badge tone={PRIORITY_TONE[item.priority] ?? 'neutral'}>{item.priority}</Badge>
          <span className="mywork__card-project">
            {item.projectIsPersonal ? 'Personal' : item.projectName}
          </span>
          {item.dueDate && (
            <span className="mywork__card-due">{formatDue(item.dueDate)}</span>
          )}
        </div>
      </Card>
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

function formatDue(dueIso) {
  const d = new Date(dueIso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
