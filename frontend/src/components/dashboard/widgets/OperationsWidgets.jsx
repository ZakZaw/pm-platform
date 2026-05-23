import { useEffect, useState } from 'react';
import { operationsApi } from '@/api/operations.api';
import { DashboardWidget, MetricRow } from '../DashboardWidget';

function useWorkflows(projectId) {
  const [workflows, setWorkflows] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    operationsApi.listWorkflows(projectId)
      .then((w) => { if (!cancelled) setWorkflows(w); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);
  return { workflows, loading };
}

export function OperationsNext7DaysWidget({ project }) {
  const { workflows, loading } = useWorkflows(project.id);
  const now = Date.now();
  const horizon = now + 7 * 86_400_000;
  // Each workflow exposes nextRunAt; show the ones whose next run lands
  // inside the next 7 days. (For multiple-run granularity per workflow
  // we'd need a dedicated /runs endpoint — Phase 2.)
  const upcoming = (workflows ?? []).filter((w) => {
    if (!w.nextRunAt) return false;
    const t = new Date(w.nextRunAt).getTime();
    return t >= now && t <= horizon;
  });
  return (
    <DashboardWidget
      title="Next 7 days"
      eyebrow="Operations"
      loading={loading}
      empty={!loading && upcoming.length === 0}
      emptyText="No workflows scheduled to run in the next week."
    >
      <MetricRow label="Runs scheduled" value={upcoming.length} />
      <ul className="dashboard-widget__rows">
        {upcoming.slice(0, 6).map((w) => (
          <li key={w.id} className="dashboard-widget__row">
            <span className="truncate">{w.name}</span>
            <span className="mono dim">
              {new Date(w.nextRunAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}

export function OperationsOverdueRunsWidget({ project }) {
  const { workflows, loading } = useWorkflows(project.id);
  const overdueTotal = (workflows ?? []).reduce((s, w) => s + (w.overdueRunCount ?? 0), 0);
  const top = (workflows ?? [])
    .filter((w) => (w.overdueRunCount ?? 0) > 0)
    .sort((a, b) => b.overdueRunCount - a.overdueRunCount)
    .slice(0, 5);
  return (
    <DashboardWidget
      title="Overdue runs"
      eyebrow="Operations"
      loading={loading}
      empty={!loading && overdueTotal === 0}
      emptyText="No overdue runs."
    >
      <MetricRow
        label="Past their scheduled time"
        value={overdueTotal}
        accent="var(--danger)"
      />
      <ul className="dashboard-widget__rows">
        {top.map((w) => (
          <li key={w.id} className="dashboard-widget__row">
            <span className="truncate">{w.name}</span>
            <span className="mono dim">{w.overdueRunCount}</span>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}

export function OperationsSkipRateWidget({ project }) {
  const { workflows, loading } = useWorkflows(project.id);
  // The list endpoint reports lastRunStatus per workflow; an aggregate
  // skip-rate requires a per-run history endpoint (Phase 2). For now we
  // surface how many workflows last finished as Skipped — a rough
  // indicator that's still better than placeholder data.
  const total = workflows?.length ?? 0;
  const skipped = (workflows ?? []).filter((w) => w.lastRunStatus === 'Skipped').length;
  const pct = total === 0 ? 0 : Math.round((skipped / total) * 100);
  return (
    <DashboardWidget
      title="Recently skipped"
      eyebrow="Operations"
      loading={loading}
      empty={!loading && total === 0}
      emptyText="No workflows yet."
    >
      <MetricRow
        label="Workflows whose last run was skipped"
        value={`${skipped} (${pct}%)`}
        accent={pct >= 20 ? 'var(--warning)' : undefined}
      />
    </DashboardWidget>
  );
}
