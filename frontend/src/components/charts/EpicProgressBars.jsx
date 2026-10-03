import './EpicProgressBars.css';

// Fallback lane colors (theme-aware tokens) when an epic has no explicit
// color set. Mirrors the categorical palette used elsewhere for epic identity.
const EPIC_COLORS = [
  'var(--accent)', 'var(--teal)', 'var(--violet)', 'var(--rose)',
  'var(--success)', 'var(--amber)', 'var(--danger)', 'var(--info)',
];

/**
 * AN-03 — per-epic completion bars. Consumes the analytics epic-progress
 * shape directly: `epics` is
 * `[{ epicId, name, color, donePoints, totalPoints, doneCount, totalCount }]`.
 * `metric` picks whether the bar tracks story points or task count.
 * `limit` caps how many epics render (already sorted heaviest-first server-side).
 */
export function EpicProgressBars({ epics = [], metric = 'points', limit }) {
  const rows = (limit ? epics.slice(0, limit) : epics).map((e, i) => {
    const done = metric === 'count' ? e.doneCount : e.donePoints;
    const total = metric === 'count' ? e.totalCount : e.totalPoints;
    return {
      id: e.epicId ?? i,
      name: e.name,
      color: e.color || EPIC_COLORS[i % EPIC_COLORS.length],
      done,
      total,
      pct: total > 0 ? Math.min(1, done / total) : 0,
    };
  });

  if (rows.length === 0) {
    return <p className="muted epic-bars-empty">No epics with tasks yet.</p>;
  }

  return (
    <div className="epic-bars">
      {rows.map((e) => (
        <div key={e.id} className="epic-bar">
          <div className="epic-bar-head">
            <span className="epic-bar-name">
              <span className="epic-bar-swatch" style={{ background: e.color }} />
              <span className="truncate">{e.name}</span>
            </span>
            <span className="epic-bar-count" title={`${e.done} of ${e.total} ${metric === 'count' ? 'tasks' : 'points'} done`}>
              {e.done}<span className="epic-bar-total">/{e.total}</span>
            </span>
          </div>
          <div className="epic-bar-track">
            <div
              className="epic-bar-fill"
              style={{ width: `${e.pct * 100}%`, background: e.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
