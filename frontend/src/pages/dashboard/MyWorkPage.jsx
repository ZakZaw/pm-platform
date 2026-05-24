import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Priority,
  Segmented,
  Select,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import { usersApi } from '@/api/users.api';
import { sprintsApi } from '@/api/sprints.api';
import { myWorkApi } from '@/api/myWork.api';
import { operationsApi } from '@/api/operations.api';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { findProjectType } from '@/constants/projectTypes';
import './MyWorkPage.css';

const ALL = '__all__';

function shortKey(item) {
  if (item.key) return item.key;
  const id = String(item.id ?? '');
  return id ? id.slice(0, 4).toUpperCase() : '—';
}

const MS_PER_DAY = 86400000;

function dueBucket(item, now) {
  if (!item.dueDate) {
    // Bucket overdue blocked/in-progress as "Later" so the page isn't empty
    return 'later';
  }
  const due = new Date(item.dueDate).getTime();
  if (!Number.isFinite(due)) return 'later';
  const dayDiff = Math.floor((due - now) / MS_PER_DAY);
  if (dayDiff < 0) return 'overdue';
  if (dayDiff === 0) return 'today';
  if (dayDiff <= 7) return 'week';
  return 'later';
}

function formatDue(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  const days = Math.floor((d.getTime() - today.getTime()) / MS_PER_DAY);
  if (days < 0) return `Overdue ${-days}d`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 6) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const SECTIONS = [
  { id: 'overdue', label: 'Overdue', tone: 'danger' },
  { id: 'today', label: 'Today', tone: 'accent' },
  { id: 'week', label: 'This week', tone: 'neutral' },
  { id: 'later', label: 'Later', tone: 'neutral' },
];

const KIND_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'task', label: 'Tasks' },
  { value: 'deal', label: 'Deals', disabled: true },
  { value: 'ticket', label: 'Tickets', disabled: true },
];

export function MyWorkPage() {
  const user = useAuthStore((s) => s.user);
  const orgs = useOrgStore((s) => s.orgs);
  const projectsByOrg = useProjectStore((s) => s.byOrg);
  const refreshProjectsForOrg = useProjectStore((s) => s.refreshForOrg);

  const [personalProject, setPersonalProject] = useState(null);
  const [items, setItems] = useState([]);
  const [activeSprints, setActiveSprints] = useState([]);
  const [operationsRuns, setOperationsRuns] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [projectFilter, setProjectFilter] = useState(ALL);
  const [sprintFilter, setSprintFilter] = useState(ALL);
  const [kindFilter, setKindFilter] = useState('all');
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
    const [data, runs] = await Promise.all([
      myWorkApi.list(params),
      operationsApi.myRuns().catch(() => []),
    ]);
    setItems(data);
    setOperationsRuns(runs);
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

  // Bucket items by due date, oldest first within each section.
  const sectioned = useMemo(() => {
    const buckets = { overdue: [], today: [], week: [], later: [] };
    const now = Date.now();
    for (const item of items) {
      buckets[dueBucket(item, now)].push(item);
    }
    for (const k of Object.keys(buckets)) {
      buckets[k].sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      });
    }
    return buckets;
  }, [items]);

  const projectCount = useMemo(
    () => new Set(items.map((i) => i.projectId).filter(Boolean)).size,
    [items],
  );

  return (
    <div className="main-inner mywork">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{user?.fullName ?? 'You'}</div>
            <h1 className="page-title">My Work</h1>
            <p className="page-subtitle" style={{ marginTop: 8 }}>
              {items.length} {items.length === 1 ? 'item' : 'items'} across {projectCount} project{projectCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="row gap-3 mywork-filters">
            <Segmented
              value={kindFilter}
              onChange={setKindFilter}
              options={KIND_FILTERS}
              ariaLabel="Filter by item kind"
            />
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
        </div>
      </div>

      {loading && (
        <div aria-busy="true" className="col gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={88} radius="lg" />
          ))}
        </div>
      )}
      {error && <p className="muted">{error}</p>}

      {!loading && !error && operationsRuns.length > 0 && (
        <OperationsRunsBanner runs={operationsRuns} />
      )}

      {!loading && !error && (
        <div className="col gap-7 mywork-sections">
          {SECTIONS.map((sec) => {
            const list = sectioned[sec.id];
            if (!list || list.length === 0) return null;
            return (
              <div key={sec.id}>
                <div className="row gap-3" style={{ marginBottom: 'var(--s-4)' }}>
                  <h3 className="h-card" style={{ fontSize: 'var(--fs-md)' }}>{sec.label}</h3>
                  <Badge tone={sec.tone}>{list.length}</Badge>
                </div>
                <div className="card">
                  {list.map((item, i) => (
                    <MyWorkRow
                      key={item.id}
                      item={item}
                      isLast={i === list.length - 1}
                      onOpen={() => setOpened({ taskId: item.id, projectId: item.projectId })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="card mywork-empty-card">
              <p className="muted">Nothing assigned to you right now.</p>
            </div>
          )}
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

function MyWorkRow({ item, isLast, onOpen }) {
  const meta = findProjectType(item.projectType);
  const iconClass = `proj-icon proj-icon-${(meta?.id ?? 'generic').toLowerCase()}`;
  const due = formatDue(item.dueDate);
  const isUrgent = item.priority === 'Urgent';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mywork-row"
      style={{ borderBottom: isLast ? 0 : '1px solid var(--divider)' }}
      aria-label={`${item.title} — ${item.status}`}
    >
      <span className="mono muted mywork-row-key">{shortKey(item)}</span>
      <div className="mywork-row-body">
        <div className="row gap-3">
          <span className="mywork-row-title truncate">{item.title}</span>
          {isUrgent && <Badge tone="danger" dot>Urgent</Badge>}
        </div>
        <div className="row gap-3 mywork-row-meta">
          <span className={iconClass} style={{ width: 14, height: 14, fontSize: 7, borderRadius: 3 }}>
            {meta?.short?.[0] ?? '·'}
          </span>
          <span>{item.projectIsPersonal ? 'Personal' : item.projectName}</span>
          {meta && <><span>·</span><span>{meta.label}</span></>}
        </div>
      </div>
      <div className="mywork-row-priority">
        <Priority level={item.priority} />
      </div>
      <StatusBadge status={item.status} />
      <span className="muted mono mywork-row-due">{due ?? '—'}</span>
    </button>
  );
}

// F1.5-05: Surfaces operations runs the user owns so overdue runbooks
// don't go unnoticed on the MyWork page (per the AC). Each run links to
// its detail page in the owning project.
function OperationsRunsBanner({ runs }) {
  const overdue = runs.filter((r) => r.isOverdue).length;
  return (
    <section className="mywork-ops">
      <header className="row mywork-ops-head">
        <span className="eyebrow">Runbooks</span>
        {overdue > 0 ? (
          <Badge tone="danger">{overdue} overdue</Badge>
        ) : (
          <Badge tone="neutral">{runs.length} due this week</Badge>
        )}
      </header>
      <ul className="mywork-ops-list">
        {runs.map((r) => {
          const orgSegment = r.orgSlug ?? 'personal';
          const to = `/${orgSegment}/projects/${r.projectSlug}/runs/${r.id}`;
          const when = new Date(r.scheduledFor).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          });
          return (
            <li key={r.id} className={['mywork-ops-row', r.isOverdue ? 'is-overdue' : ''].filter(Boolean).join(' ')}>
              <Link to={to} className="mywork-ops-link">
                <span className="mywork-ops-title">{r.workflowName}</span>
                <span className="muted mywork-ops-meta">
                  {r.projectName} · scheduled {when}
                </span>
              </Link>
              <span className="mono muted">
                {r.completedItemCount}/{r.itemCount}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
