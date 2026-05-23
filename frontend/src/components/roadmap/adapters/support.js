import { supportApi } from '@/api/support.api';

const QUEUE_COLORS = [
  '#5B6AF0', '#4FD1E0', '#E5484D', '#E0A23A', '#3FB984', '#7A6BFF',
];

// Support doesn't have a natural timeline. We surface the nearest SLA
// deadlines as point markers so an oncall can see which tickets are
// about to breach. No "bars" — Support's work is a queue, not a project
// plan. The empty-state copy is explicit so users don't think it's bug.
export async function supportRoadmap(projectId) {
  const view = await supportApi.getQueueView(projectId).catch(() => null);
  const queues = view?.queues ?? [];

  const points = [];
  for (const q of queues) {
    const color = QUEUE_COLORS[(q.order ?? 0) % QUEUE_COLORS.length];
    for (const t of q.tickets ?? []) {
      if (!t.slaDueAt) continue;
      points.push({
        id: `ticket-${t.id}`,
        label: t.subject,
        at: t.slaDueAt,
        color: t.isBreached ? 'var(--danger)' : color,
        kind: 'milestone',
        sublabel: `${q.name}${t.isBreached ? ' · breached' : ''}`,
      });
    }
  }

  return {
    bars: [],
    points,
    range: rangeFromPoints(points),
    emptyHint: points.length === 0
      ? 'Open tickets with active SLAs will appear here as deadline markers.'
      : 'Support work is a queue, not a plan — markers show upcoming SLA deadlines.',
  };
}

function rangeFromPoints(points) {
  const now = Date.now();
  if (points.length === 0) {
    return {
      from: new Date(now - 86_400_000).toISOString(),
      to: new Date(now + 7 * 86_400_000).toISOString(),
    };
  }
  const dates = points.map((p) => new Date(p.at).getTime());
  const min = Math.min(now - 86_400_000, ...dates);
  const max = Math.max(now + 86_400_000, ...dates);
  return { from: new Date(min).toISOString(), to: new Date(max).toISOString() };
}
