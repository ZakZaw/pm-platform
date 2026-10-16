// F1.5-08 — roadmap adapter registry. Each project type registers an
// adapter that loads its data and shapes it into the unified roadmap model
// below. `RoadmapView` and `RoadmapPage` are type-agnostic — they only render
// the shape returned here, so adding a project type means one line here.
//
// Engineering keeps its editable adapter (GET /projects/{id}/roadmap: epic
// drag-resize, dependencies, milestones, share links). Every other type reads
// the server-computed, type-aware timeline (GET /projects/{id}/roadmap/timeline)
// through the shared `timelineRoadmap` adapter — the type-specific shaping
// (deals by close quarter, SLA deadlines per queue, campaign spans + assets,
// runs per workflow, tasks per list) lives in GetProjectTimelineQuery.
//
// Adapter shape:
//   loadRoadmap(projectId): Promise<{
//     bars:   [{ id, label, start, end, color, sublabel?, ownerId?, ownerName?, riskFlag? }]
//     points: [{ id, label, at, color, kind?, editable?, epicId?, flagged? }]
//     groups?: [{ id, label, sublabel?, bars: [...], points: [...] }]   // one lane each
//     stats?:  [{ label, value, tone }]                                 // headline strip
//     range:  { from, to }                        // ISO date strings
//     dependencies?: [{ from, to }]               // edge ids — arrow bar→bar
//     undated?:      [{ id, title }]              // work with no dates yet
//     undatedTitle?, undatedHint?: string         // copy for the undated panel
//     emptyHint?:    string                       // shown when nothing to plot
//     editable?:     boolean                      // gates drag-resize handles
//     capabilities?: { milestones, share }        // gates page actions
//   }>

import { engineeringRoadmap } from './adapters/engineering';
import { timelineRoadmap } from './adapters/timeline';

export const ROADMAP_ADAPTERS = {
  Engineering: engineeringRoadmap,
  Sales: timelineRoadmap,
  Support: timelineRoadmap,
  Marketing: timelineRoadmap,
  Operations: timelineRoadmap,
  Generic: timelineRoadmap,
};

export function adapterForType(type) {
  return ROADMAP_ADAPTERS[type] ?? timelineRoadmap;
}
