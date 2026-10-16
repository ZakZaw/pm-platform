import { roadmapApi } from '@/api/roadmap.api';

// F1.5-08 — server-computed, type-aware timeline adapter. Every non-engineering
// type reads ONE aggregate from GET /projects/{id}/roadmap/timeline (shaped
// per type by GetProjectTimelineQuery) instead of deriving a timeline
// client-side from the list endpoints. The payload's `type` field says which
// shape it is; this adapter only maps it onto the RoadmapView model:
//
//   groups:  one lane per server group (deal stage, queue, campaign,
//            workflow, list…) holding its own bars + markers
//   stats:   headline numbers shown above the timeline
//   undated: work that has no date yet
//
// Engineering keeps its own editable adapter (epic drag, dependencies,
// milestones, share links) on GET /projects/{id}/roadmap.

// Marker kinds → RoadmapView point shapes.
const POINT_SHAPE = {
  milestone: 'milestone',
  deal: 'target',
  run: 'run',
  sla: 'sla',
  asset: 'milestone',
  task: 'task',
};

// Per-type copy for the "not yet placed" panel.
const UNDATED_COPY = {
  Engineering: { title: 'Not yet placed', hint: 'Open an epic and set its start & end dates to add it to the timeline.' },
  Sales: { title: 'No expected close date', hint: 'Set an expected close date on these deals to place them on the timeline.' },
  Marketing: { title: 'Campaigns without dates', hint: 'Give these campaigns a start and end date to draw their span.' },
};

/**
 * Semantic tone keyword (from the server) → design token. Keeps every colour
 * on the token vocabulary — no hex values in adapters.
 * @param {string | null | undefined} tone
 * @returns {string}
 */
export function toneColor(tone) {
  if (!tone || tone === 'neutral') return 'var(--text-muted)';
  if (tone.startsWith('mkt-')) return `var(--mkt-channel-${tone.slice(4)})`;
  return `var(--${tone})`;
}

/**
 * Maps the server timeline payload onto the RoadmapView model. Exported for tests.
 * @param {object} t ProjectTimelineDto
 */
export function mapTimeline(t) {
  const bar = (b) => ({
    id: b.id,
    label: b.label,
    start: b.start,
    end: b.end,
    color: toneColor(b.tone),
    sublabel: b.sublabel ?? null,
    riskFlag: !!b.flagged,
  });
  const point = (m) => ({
    id: m.id,
    label: m.label,
    at: m.at,
    color: toneColor(m.tone),
    kind: POINT_SHAPE[m.kind] ?? 'milestone',
    sublabel: m.sublabel ?? null,
    flagged: !!m.flagged,
    editable: false,
  });

  const groupIds = new Set((t.groups ?? []).map((g) => g.id));
  const groups = (t.groups ?? []).map((g) => ({
    id: g.id,
    label: g.label,
    sublabel: g.sublabel ?? null,
    bars: (t.bars ?? []).filter((b) => b.groupId === g.id).map(bar),
    points: (t.markers ?? []).filter((m) => m.groupId === g.id).map(point),
  }));
  const copy = UNDATED_COPY[t.type] ?? { title: 'Not yet placed', hint: null };

  return {
    type: t.type,
    bars: (t.bars ?? []).filter((b) => !groupIds.has(b.groupId)).map(bar),
    points: (t.markers ?? []).filter((m) => !groupIds.has(m.groupId)).map(point),
    groups,
    stats: (t.stats ?? []).map((s) => ({ label: s.label, value: s.value, tone: s.tone ?? 'neutral' })),
    range: { from: t.from, to: t.to },
    undated: (t.undated ?? []).map((u) => ({ id: u.id, title: u.label })),
    undatedTitle: copy.title,
    undatedHint: copy.hint,
    emptyHint: t.emptyHint ?? undefined,
    editable: false,
    capabilities: { milestones: false, share: false },
  };
}

export async function timelineRoadmap(projectId) {
  const t = await roadmapApi.timeline(projectId).catch(() => null);
  if (!t) {
    const now = new Date();
    return {
      bars: [],
      points: [],
      groups: [],
      stats: [],
      range: {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        to: new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString(),
      },
      undated: [],
      emptyHint: "Couldn't load the timeline. Check that the project still exists.",
      editable: false,
      capabilities: { milestones: false, share: false },
    };
  }
  return mapTimeline(t);
}
