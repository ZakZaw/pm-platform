import { listsApi } from '@/api/lists.api';

// Generic projects don't have a structural timeline — they're lightweight
// task lists. The adapter still implements the contract so the registry
// returns a non-null shape; it surfaces tasks with due dates as point
// markers and skips the bar lane.
export async function genericRoadmap(projectId) {
  const view = await listsApi.getView(projectId).catch(() => null);
  const lists = view?.lists ?? [];
  const unsorted = view?.unsorted ?? [];

  const all = [
    ...unsorted.map((t) => ({ ...t, listName: 'Unsorted' })),
    ...lists.flatMap((l) => l.tasks.map((t) => ({ ...t, listName: l.name }))),
  ];

  const points = all
    .filter((t) => t.dueDate && t.status !== 'Done' && t.status !== 'WontDo')
    .map((t) => ({
      id: `task-${t.id}`,
      label: t.title,
      at: t.dueDate,
      color: 'var(--accent-primary)',
      kind: 'milestone',
      sublabel: t.listName,
    }));

  return {
    bars: [],
    points,
    range: rangeFromPoints(points),
    emptyHint: points.length === 0
      ? 'Generic projects are list-shaped — add due dates to surface them here.'
      : 'Generic projects don\'t have epic spans — markers show task due dates instead.',
  };
}

function rangeFromPoints(points) {
  const now = Date.now();
  if (points.length === 0) {
    return {
      from: new Date(now).toISOString(),
      to: new Date(now + 30 * 86_400_000).toISOString(),
    };
  }
  const dates = points.map((p) => new Date(p.at).getTime());
  const min = Math.min(now, ...dates);
  const max = Math.max(now + 7 * 86_400_000, ...dates);
  return { from: new Date(min).toISOString(), to: new Date(max).toISOString() };
}
