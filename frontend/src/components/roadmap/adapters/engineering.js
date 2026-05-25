import { roadmapApi } from '@/api/roadmap.api';
import { sprintsApi } from '@/api/sprints.api';

const EPIC_PALETTE = [
  '#5B6AF0', '#4FD1E0', '#7A6BFF', '#C77BFF',
  '#3FB984', '#E0A23A', '#E5484D', '#4F9EFF',
];

// Engineering roadmap (F2-01). Source of truth: each epic carries its own
// startDate/endDate, plus a dependency graph and standalone milestones,
// all returned from GET /projects/{id}/roadmap. Active-sprint marker is
// derived on the side and merged with backend milestones for the points
// row.
//
// Epics without dates are kept in the response payload but excluded from
// the bar lanes — they show in the empty-state hint until a PM places them.
export async function engineeringRoadmap(projectId) {
  const [roadmap, sprints] = await Promise.all([
    roadmapApi.get(projectId).catch(() => null),
    sprintsApi.listForProject(projectId).catch(() => []),
  ]);

  if (!roadmap) {
    return {
      bars: [],
      points: [],
      range: defaultRange(),
      dependencies: [],
      undated: [],
      emptyHint: "Couldn't load the roadmap. Check that the project still exists.",
      editable: true,
    };
  }

  const bars = roadmap.epics
    .filter((e) => e.startDate && e.endDate)
    .map((e, i) => ({
      id: e.id,
      label: e.title,
      start: e.startDate,
      end: e.endDate,
      color: e.color ?? EPIC_PALETTE[i % EPIC_PALETTE.length],
      sublabel: e.status ?? null,
      ownerId: e.ownerId,
      ownerName: e.ownerName,
      riskFlag: e.riskFlag,
    }));

  const milestonePoints = (roadmap.milestones ?? []).map((m) => ({
    id: m.id,
    label: m.title,
    at: m.date,
    color: m.color ?? 'var(--accent)',
    kind: 'milestone',
    epicId: m.epicId,
    editable: true,
  }));

  // Active-sprint marker keeps the visual cue we already had — but tagged
  // 'sprint' so the UI can render it differently and skip the milestone
  // edit affordances.
  const activeSprint = sprints.find((s) => s.status === 'Active');
  const sprintMarkers = activeSprint && activeSprint.endDate
    ? [{
        id: `sprint-${activeSprint.id}`,
        label: `${activeSprint.name} ends`,
        at: activeSprint.endDate,
        color: 'var(--accent)',
        kind: 'sprint',
        editable: false,
      }]
    : [];

  const undated = roadmap.epics
    .filter((e) => !e.startDate || !e.endDate)
    .map((e) => ({ id: e.id, title: e.title }));

  return {
    bars,
    points: [...milestonePoints, ...sprintMarkers],
    range: { from: roadmap.from, to: roadmap.to },
    dependencies: roadmap.epics.flatMap((e) =>
      (e.dependsOn ?? []).map((depId) => ({ from: depId, to: e.id }))),
    undated,
    emptyHint: bars.length === 0
      ? 'No epics placed on the timeline yet. Set start and end dates on an epic to see it here.'
      : undefined,
    editable: true,
  };
}

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
