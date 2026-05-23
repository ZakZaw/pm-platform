import { useEffect, useMemo, useState } from 'react';
import { listsApi } from '@/api/lists.api';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useParams } from 'react-router-dom';
import { DashboardWidget, MetricRow, StackedBar } from '../DashboardWidget';

const PALETTE = ['#5B6AF0', '#4FD1E0', '#7A6BFF', '#C77BFF', '#3FB984', '#E0A23A', '#E5484D', '#4F9EFF'];

function useView(projectId) {
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    listsApi.getView(projectId)
      .then((v) => { if (!cancelled) setView(v); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);
  return { view, loading };
}

function flattenTasks(view) {
  if (!view) return [];
  return [
    ...view.unsorted,
    ...view.lists.flatMap((l) => l.tasks),
  ];
}

export function GenericOpenTasksWidget({ project }) {
  const { view, loading } = useView(project.id);
  const tasks = flattenTasks(view);
  const open = tasks.filter((t) => t.status !== 'Done' && t.status !== 'WontDo');
  return (
    <DashboardWidget
      title="Open tasks"
      eyebrow="Generic"
      loading={loading}
      empty={!loading && tasks.length === 0}
      emptyText="No tasks yet."
    >
      <MetricRow
        label="Currently open"
        value={open.length}
        sublabel={`${tasks.length} total across all lists`}
      />
    </DashboardWidget>
  );
}

export function GenericByAssigneeWidget({ project }) {
  const { slug: orgSlug } = useParams();
  const { view, loading } = useView(project.id);
  const { members } = useOrgMembers(orgSlug);
  const memberById = useMemo(() => {
    const m = {};
    for (const x of members) m[x.userId] = x;
    return m;
  }, [members]);

  const tasks = flattenTasks(view).filter((t) => t.status !== 'Done' && t.status !== 'WontDo');
  const tallies = new Map();
  for (const t of tasks) {
    const key = t.assigneeId ?? '__unassigned__';
    tallies.set(key, (tallies.get(key) ?? 0) + 1);
  }
  const segments = Array.from(tallies.entries())
    .map(([key, count], i) => ({
      label: key === '__unassigned__' ? 'Unassigned' : (memberById[key]?.fullName ?? 'Unknown'),
      value: count,
      color: PALETTE[i % PALETTE.length],
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <DashboardWidget
      title="By assignee"
      eyebrow="Generic"
      loading={loading}
      empty={!loading && segments.length === 0}
      emptyText="Assign tasks to see this breakdown."
    >
      {segments.length > 0 && <StackedBar segments={segments} />}
    </DashboardWidget>
  );
}

export function GenericCompletionRateWidget({ project }) {
  const { view, loading } = useView(project.id);
  const tasks = flattenTasks(view);
  const done = tasks.filter((t) => t.status === 'Done').length;
  const pct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);
  return (
    <DashboardWidget
      title="Completion rate"
      eyebrow="Generic"
      loading={loading}
      empty={!loading && tasks.length === 0}
      emptyText="Complete a task to see this fill in."
    >
      <MetricRow
        label="Done"
        value={`${pct}%`}
        sublabel={`${done} of ${tasks.length} tasks complete`}
      />
      <div className="dashboard-widget__bar" aria-hidden="true">
        <span
          className="dashboard-widget__bar-seg"
          style={{ width: `${pct}%`, background: 'var(--status-success)' }}
        />
      </div>
    </DashboardWidget>
  );
}
