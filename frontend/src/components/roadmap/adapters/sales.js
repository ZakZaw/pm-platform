import { salesApi } from '@/api/sales.api';

const STAGE_COLORS = [
  '#5B6AF0', '#4FD1E0', '#7A6BFF', '#C77BFF',
  '#3FB984', '#E0A23A', '#E5484D',
];

// Sales roadmap: quarterly target lines based on expected-close dates of
// open deals, grouped by quarter. Each deal becomes a point on the
// timeline — large clusters indicate a target push. Quarter boundary
// lines render as bars for visual reference.
export async function salesRoadmap(projectId) {
  const pipeline = await salesApi.getPipeline(projectId).catch(() => null);
  const stages = pipeline?.stages ?? [];

  const deals = [];
  for (const stage of stages) {
    const stageColor = STAGE_COLORS[(stage.order ?? 0) % STAGE_COLORS.length];
    for (const d of stage.deals ?? []) {
      if (!d.expectedClose) continue;
      deals.push({ ...d, stageName: stage.name, stageColor });
    }
  }

  const points = deals.map((d) => ({
    id: `deal-${d.id}`,
    label: d.name,
    at: d.expectedClose,
    color: d.stageColor,
    kind: 'target',
    sublabel: `${d.stageName} · ${d.probability ?? 0}%`,
  }));

  // Bars: quarter spans covering the date range of the deals.
  const range = pointsRange(points);
  const bars = quartersInRange(range).map((q, i) => ({
    id: `q-${q.label}`,
    label: q.label,
    start: q.start,
    end: q.end,
    color: i % 2 === 0 ? 'var(--accent-soft)' : 'var(--surface-2)',
    sublabel: `${deals.filter((d) => d.expectedClose >= q.start && d.expectedClose < q.end).length} deals`,
  }));

  return {
    bars,
    points,
    range,
    emptyHint: deals.length === 0
      ? 'Add deals with expected close dates to see them on the quarterly timeline.'
      : undefined,
  };
}

function pointsRange(points) {
  if (points.length === 0) {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth() + 5, 1).toISOString(),
    };
  }
  const dates = points.map((p) => new Date(p.at).getTime());
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const from = new Date(min);
  from.setDate(1);
  const to = new Date(max);
  to.setMonth(to.getMonth() + 1);
  to.setDate(1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function quartersInRange({ from, to }) {
  const out = [];
  const start = new Date(from);
  start.setDate(1);
  start.setMonth(Math.floor(start.getMonth() / 3) * 3);
  const end = new Date(to);
  let cursor = start;
  while (cursor < end) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1);
    const q = Math.floor(cursor.getMonth() / 3) + 1;
    out.push({
      label: `Q${q} ${cursor.getFullYear()}`,
      start: cursor.toISOString(),
      end: next.toISOString(),
    });
    cursor = next;
  }
  return out;
}
