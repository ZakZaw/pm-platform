// F1.5-08 — roadmap adapter registry. Each project type registers an
// adapter that loads its own data and shapes it into the unified roadmap
// model below. The `RoadmapView` component is type-agnostic — it only
// renders the shape returned here.
//
// Adapter shape:
//   loadRoadmap(projectId): Promise<{
//     bars:   [{ id, label, start, end, color, sublabel?, ownerId?, ownerName?, riskFlag? }]
//     points: [{ id, label, at, color, kind?, editable?, epicId? }]
//                                                 // 'milestone' | 'run' | 'target' | 'sprint'
//     range:  { from, to }                        // ISO date strings (date-only)
//     dependencies?: [{ from, to }]               // edge ids — render arrow from bar→bar
//     undated?:      [{ id, title }]              // epics that have no dates yet
//     emptyHint?:    string                       // shown when bars+points are empty
//     editable?:     boolean                      // gates drag-resize handles in the view
//   }>
//
// All dates returned must be ISO strings — the view doesn't try to be
// clever about timezones. The page passes through what the adapter
// returns. Adding a new type means writing a new adapter and adding
// one line here.

import { engineeringRoadmap } from './adapters/engineering';
import { salesRoadmap } from './adapters/sales';
import { supportRoadmap } from './adapters/support';
import { marketingRoadmap } from './adapters/marketing';
import { operationsRoadmap } from './adapters/operations';
import { genericRoadmap } from './adapters/generic';

export const ROADMAP_ADAPTERS = {
  Engineering: engineeringRoadmap,
  Sales: salesRoadmap,
  Support: supportRoadmap,
  Marketing: marketingRoadmap,
  Operations: operationsRoadmap,
  Generic: genericRoadmap,
};

export function adapterForType(type) {
  return ROADMAP_ADAPTERS[type] ?? null;
}
