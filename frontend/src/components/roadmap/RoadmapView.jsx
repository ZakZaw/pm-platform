import { useMemo } from 'react';
import { Icon } from '@/components/ui';
import './RoadmapView.css';

// F1.5-08 — type-agnostic timeline renderer. Receives the unified
// `{ bars, points, range }` shape from a per-type adapter and lays
// everything out against a single time axis. No project-type code
// belongs in here.
export function RoadmapView({ data, loading, error }) {
  const layout = useMemo(() => computeLayout(data), [data]);

  if (loading) {
    return <div className="roadmap-view roadmap-view--loading">Loading…</div>;
  }
  if (error) {
    return <p className="roadmap-view__error">{error}</p>;
  }
  if (!data) return null;

  const { bars, points, emptyHint } = data;
  const isEmpty = bars.length === 0 && points.length === 0;

  return (
    <div className="roadmap-view">
      <div className="roadmap-view__axis">
        {layout.ticks.map((t) => (
          <span
            key={t.at}
            className="roadmap-view__tick"
            style={{ left: `${t.pct}%` }}
          >
            {t.label}
          </span>
        ))}
        {layout.todayPct != null && (
          <span
            className="roadmap-view__today"
            style={{ left: `${layout.todayPct}%` }}
            aria-label="Today"
          >
            <Icon name="dot" size={14} color="var(--accent)" />
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="roadmap-view__empty">
          <Icon name="calendar" size={20} color="var(--text-muted)" />
          <p className="roadmap-view__empty-text">{emptyHint ?? 'No timeline data yet.'}</p>
        </div>
      ) : (
        <>
          {emptyHint && bars.length + points.length > 0 && (
            <p className="roadmap-view__hint">{emptyHint}</p>
          )}
          {bars.length > 0 && (
            <ul className="roadmap-view__lanes">
              {bars.map((bar) => {
                const placed = layout.placeBar(bar);
                if (!placed) return null;
                return (
                  <li key={bar.id} className="roadmap-view__lane">
                    <span className="roadmap-view__lane-label">
                      {bar.label}
                      {bar.sublabel && (
                        <span className="muted roadmap-view__lane-sub">{bar.sublabel}</span>
                      )}
                    </span>
                    <span className="roadmap-view__track">
                      {layout.todayPct != null && (
                        <span
                          className="roadmap-view__track-today"
                          style={{ left: `${layout.todayPct}%` }}
                        />
                      )}
                      <span
                        className="roadmap-view__bar"
                        style={{
                          left: `${placed.left}%`,
                          width: `${placed.width}%`,
                          background: bar.color,
                        }}
                        title={`${bar.label} · ${formatDate(bar.start)} → ${formatDate(bar.end)}`}
                      >
                        <span className="roadmap-view__bar-label">{bar.label}</span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {points.length > 0 && (
            <div className="roadmap-view__points-area">
              <div className="roadmap-view__points-head">
                <span className="subsection-eyebrow">Markers</span>
                <span className="muted mono">{points.length}</span>
              </div>
              <div className="roadmap-view__points-track">
                {layout.todayPct != null && (
                  <span
                    className="roadmap-view__track-today"
                    style={{ left: `${layout.todayPct}%` }}
                  />
                )}
                {points.map((p) => {
                  const pct = layout.placePoint(p);
                  if (pct == null) return null;
                  return (
                    <span
                      key={p.id}
                      className={`roadmap-view__point roadmap-view__point--${p.kind ?? 'milestone'}`}
                      style={{ left: `${pct}%`, background: p.color }}
                      title={`${p.label} · ${formatDate(p.at)}${p.sublabel ? ` · ${p.sublabel}` : ''}`}
                    />
                  );
                })}
              </div>
              <ul className="roadmap-view__points-legend">
                {points.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <span
                      className="roadmap-view__point-swatch"
                      style={{ background: p.color }}
                    />
                    <span className="truncate">{p.label}</span>
                    <span className="mono dim">{formatDate(p.at)}</span>
                  </li>
                ))}
                {points.length > 8 && (
                  <li className="muted">+{points.length - 8} more…</li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function computeLayout(data) {
  if (!data) return { ticks: [], todayPct: null, placeBar: () => null, placePoint: () => null };
  const from = new Date(data.range.from).getTime();
  const to = new Date(data.range.to).getTime();
  const span = Math.max(1, to - from);

  function pct(at) {
    const ms = new Date(at).getTime();
    return ((ms - from) / span) * 100;
  }

  function placeBar(bar) {
    const left = pct(bar.start);
    const right = pct(bar.end);
    const width = Math.max(1, right - left);
    if (right < 0 || left > 100) return null;
    return {
      left: Math.max(0, left),
      width: Math.min(100 - Math.max(0, left), width),
    };
  }

  function placePoint(p) {
    const x = pct(p.at);
    if (x < -2 || x > 102) return null;
    return Math.max(0, Math.min(100, x));
  }

  const now = Date.now();
  const todayPct = now >= from && now <= to ? ((now - from) / span) * 100 : null;

  return {
    ticks: buildTicks(from, to),
    todayPct,
    placeBar,
    placePoint,
  };
}

function buildTicks(fromMs, toMs) {
  const span = toMs - fromMs;
  const days = span / 86_400_000;
  const out = [];
  // Pick a tick granularity that gives ~4-8 ticks total.
  if (days <= 21) {
    // Day ticks every 3 days
    const cursor = new Date(fromMs);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= toMs) {
      const pct = ((cursor.getTime() - fromMs) / span) * 100;
      if (pct >= 0 && pct <= 100) {
        out.push({
          at: cursor.getTime(),
          pct,
          label: cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        });
      }
      cursor.setDate(cursor.getDate() + 3);
    }
  } else if (days <= 120) {
    // Week ticks
    const cursor = new Date(fromMs);
    cursor.setDate(cursor.getDate() - cursor.getDay() + 1);
    cursor.setHours(0, 0, 0, 0);
    let i = 0;
    while (cursor.getTime() <= toMs) {
      const pct = ((cursor.getTime() - fromMs) / span) * 100;
      if (pct >= 0 && pct <= 100 && i % 2 === 0) {
        out.push({
          at: cursor.getTime(),
          pct,
          label: cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        });
      }
      cursor.setDate(cursor.getDate() + 7);
      i++;
    }
  } else {
    // Month ticks
    const cursor = new Date(fromMs);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= toMs) {
      const pct = ((cursor.getTime() - fromMs) / span) * 100;
      if (pct >= 0 && pct <= 100) {
        out.push({
          at: cursor.getTime(),
          pct,
          label: cursor.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return out;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
