import { operationsApi } from '@/api/operations.api';

const WORKFLOW_COLORS = [
  '#5B6AF0', '#4FD1E0', '#7A6BFF', '#C77BFF',
  '#3FB984', '#E0A23A', '#4F9EFF',
];

// Operations roadmap: each workflow's next scheduled run as a point on
// the timeline. The bar lane is empty — runs are instantaneous events,
// not spans. Overdue runs render in danger color so they're obvious.
export async function operationsRoadmap(projectId) {
  const workflows = await operationsApi.listWorkflows(projectId).catch(() => []);

  const now = Date.now();
  const points = [];
  for (const [i, w] of workflows.entries()) {
    const color = WORKFLOW_COLORS[i % WORKFLOW_COLORS.length];
    if (w.nextRunAt) {
      points.push({
        id: `next-${w.id}`,
        label: w.name,
        at: w.nextRunAt,
        color,
        kind: 'run',
        sublabel: 'next run',
      });
    }
    if ((w.overdueRunCount ?? 0) > 0 && w.nextRunAt) {
      points.push({
        id: `overdue-${w.id}`,
        label: `${w.name} (overdue ×${w.overdueRunCount})`,
        // Overdue runs are by definition in the past — pin them to "now"
        // so they show at the playhead rather than off-screen.
        at: new Date(now).toISOString(),
        color: 'var(--status-danger)',
        kind: 'run',
        sublabel: 'past scheduled',
      });
    }
  }

  return {
    bars: [],
    points,
    range: rangeFromPoints(points),
    emptyHint: points.length === 0
      ? 'Add workflows with a recurrence rule to see their next runs scheduled here.'
      : undefined,
  };
}

function rangeFromPoints(points) {
  const now = Date.now();
  if (points.length === 0) {
    return {
      from: new Date(now - 7 * 86_400_000).toISOString(),
      to: new Date(now + 14 * 86_400_000).toISOString(),
    };
  }
  const dates = points.map((p) => new Date(p.at).getTime());
  const min = Math.min(now - 86_400_000, ...dates);
  const max = Math.max(now + 7 * 86_400_000, ...dates);
  return { from: new Date(min).toISOString(), to: new Date(max).toISOString() };
}
