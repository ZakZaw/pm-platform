import { epicsApi } from '@/api/epics.api';
import { boardApi } from '@/api/board.api';
import { sprintsApi } from '@/api/sprints.api';

const EPIC_PALETTE = [
  '#5B6AF0', '#4FD1E0', '#7A6BFF', '#C77BFF',
  '#3FB984', '#E0A23A', '#E5484D', '#4F9EFF',
];

// Engineering roadmap: one bar per epic, spanning the sprints that
// contain its tasks. Sprint dates are the source of truth — Epic itself
// doesn't carry start/end, but its work lives inside sprints. Fallback
// to the project window when an epic has no sprint coverage yet.
export async function engineeringRoadmap(projectId) {
  const [epics, board, sprints] = await Promise.all([
    epicsApi.listForProject(projectId).catch(() => []),
    boardApi.get(projectId).catch(() => null),
    sprintsApi.listForProject(projectId).catch(() => []),
  ]);

  const sprintById = new Map(sprints.map((s) => [s.id, s]));
  const epicSprints = new Map(); // epicId → Set<sprintId>
  if (board) {
    for (const lane of board.swimlanes) {
      for (const col of lane.columns) {
        for (const card of col.cards) {
          if (!card.epicId || !card.sprintId) continue;
          if (!epicSprints.has(card.epicId)) epicSprints.set(card.epicId, new Set());
          epicSprints.get(card.epicId).add(card.sprintId);
        }
      }
    }
  }

  const projectStart = sprints.length > 0
    ? sprints.reduce((m, s) => s.startDate && (!m || s.startDate < m) ? s.startDate : m, null)
    : null;
  const projectEnd = sprints.length > 0
    ? sprints.reduce((m, s) => s.endDate && (!m || s.endDate > m) ? s.endDate : m, null)
    : null;

  const bars = epics.map((e, i) => {
    const sprintIds = epicSprints.get(e.id);
    let start = projectStart;
    let end = projectEnd;
    if (sprintIds && sprintIds.size > 0) {
      const epicSprintRows = Array.from(sprintIds)
        .map((id) => sprintById.get(id))
        .filter(Boolean);
      const earliest = epicSprintRows.reduce(
        (m, s) => s.startDate && (!m || s.startDate < m) ? s.startDate : m, null);
      const latest = epicSprintRows.reduce(
        (m, s) => s.endDate && (!m || s.endDate > m) ? s.endDate : m, null);
      if (earliest) start = earliest;
      if (latest) end = latest;
    }
    return {
      id: e.id,
      label: e.title,
      start,
      end,
      color: e.color ?? EPIC_PALETTE[i % EPIC_PALETTE.length],
      sublabel: e.status ?? null,
    };
  }).filter((b) => b.start && b.end);

  // Active sprint marker
  const points = [];
  const active = sprints.find((s) => s.status === 'Active');
  if (active && active.endDate) {
    points.push({
      id: `sprint-${active.id}`,
      label: `${active.name} ends`,
      at: active.endDate,
      color: 'var(--accent-primary)',
      kind: 'milestone',
    });
  }

  const range = bars.length > 0
    ? {
        from: bars.reduce((m, b) => (b.start < m ? b.start : m), bars[0].start),
        to: bars.reduce((m, b) => (b.end > m ? b.end : m), bars[0].end),
      }
    : projectStart && projectEnd ? { from: projectStart, to: projectEnd }
    : defaultRange();

  return {
    bars,
    points,
    range,
    emptyHint: bars.length === 0
      ? 'Add sprints and link tasks to epics — epic bars span their sprints.'
      : undefined,
  };
}

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  return { from: start.toISOString(), to: end.toISOString() };
}
