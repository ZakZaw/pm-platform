import { useCallback, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import './RoadmapView.css';

// F2-01 — type-agnostic timeline renderer. Receives the unified
// `{ bars, points, range, dependencies?, editable? }` shape from a per-type
// adapter and lays everything out against a single time axis. No project-type
// code belongs in here.
//
// Edit affordances (drag handles, click-to-edit) are gated by both
// `roleCanEdit` (set by the page from project.myRole) and `data.editable`
// (set by the adapter — read-only types like support still omit it).
export function RoadmapView({
  data,
  loading,
  error,
  zoom,
  roleCanEdit = false,
  onResize,
  onPointClick,
}) {
  const layout = useMemo(() => computeLayout(data, zoom), [data, zoom]);
  const trackRefs = useRef(new Map());

  // Optimistic shifts. While the user is dragging a handle, the bar should
  // visually follow the pointer even though we haven't sent the PATCH yet.
  const [previewShift, setPreviewShift] = useState(null);

  const handlePointerDown = useCallback((e, bar, edge) => {
    if (!roleCanEdit || !data?.editable) return;
    e.preventDefault();
    e.stopPropagation();

    const track = trackRefs.current.get(bar.id);
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const from = new Date(data.range.from).getTime();
    const to = new Date(data.range.to).getTime();
    const days = Math.max(1, Math.round((to - from) / 86_400_000));
    const pxPerDay = rect.width / days;

    const originalStart = new Date(bar.start);
    const originalEnd = new Date(bar.end);

    function pointerToDays(clientX) {
      return Math.round((clientX - rect.left) / pxPerDay);
    }

    function onMove(ev) {
      const dayOffset = pointerToDays(ev.clientX);
      // Clamp so the bar stays inside the visible range.
      const start = new Date(from);
      start.setUTCDate(start.getUTCDate() + dayOffset);

      let nextStart = originalStart;
      let nextEnd = originalEnd;
      if (edge === 'start') {
        nextStart = start;
        if (nextStart > originalEnd) nextStart = originalEnd;
      } else {
        nextEnd = start;
        if (nextEnd < originalStart) nextEnd = originalStart;
      }
      setPreviewShift({
        barId: bar.id,
        start: nextStart.toISOString().slice(0, 10),
        end: nextEnd.toISOString().slice(0, 10),
      });
    }
    function onUp(ev) {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      // Read the final position from the same pointer math so onResize
      // isn't sensitive to React batch timing.
      const dayOffset = pointerToDays(ev.clientX);
      const start = new Date(from);
      start.setUTCDate(start.getUTCDate() + dayOffset);
      let finalStart = originalStart;
      let finalEnd = originalEnd;
      if (edge === 'start') {
        finalStart = start > originalEnd ? originalEnd : start;
      } else {
        finalEnd = start < originalStart ? originalStart : start;
      }
      setPreviewShift(null);
      const startISO = finalStart.toISOString().slice(0, 10);
      const endISO = finalEnd.toISOString().slice(0, 10);
      if (startISO === bar.start && endISO === bar.end) return;
      onResize?.(bar.id, { startDate: startISO, endDate: endISO });
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [roleCanEdit, data, onResize]);

  if (loading) {
    return <div className="roadmap-view roadmap-view--loading">Loading…</div>;
  }
  if (error) {
    return <p className="roadmap-view__error">{error}</p>;
  }
  if (!data) return null;

  const { bars, points, emptyHint } = data;
  const isEmpty = bars.length === 0 && points.length === 0;
  const canEdit = roleCanEdit && data.editable;

  return (
    <div className="roadmap-view" data-editable={canEdit ? 'true' : 'false'}>
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
            <div className="roadmap-view__lanes-wrap">
              <DependencyArrows
                bars={bars}
                dependencies={data.dependencies ?? []}
                layout={layout}
                previewShift={previewShift}
              />
              <ul className="roadmap-view__lanes">
              {bars.map((bar) => {
                const shown = previewShift?.barId === bar.id
                  ? { ...bar, start: previewShift.start, end: previewShift.end }
                  : bar;
                const placed = layout.placeBar(shown);
                if (!placed) return null;
                return (
                  <li key={bar.id} className="roadmap-view__lane">
                    <span className="roadmap-view__lane-label">
                      {bar.label}
                      {bar.sublabel && (
                        <span className="muted roadmap-view__lane-sub">{bar.sublabel}</span>
                      )}
                    </span>
                    <span
                      className="roadmap-view__track"
                      ref={(el) => {
                        if (el) trackRefs.current.set(bar.id, el);
                        else trackRefs.current.delete(bar.id);
                      }}
                    >
                      {layout.todayPct != null && (
                        <span
                          className="roadmap-view__track-today"
                          style={{ left: `${layout.todayPct}%` }}
                        />
                      )}
                      <span
                        className="roadmap-view__bar"
                        data-bar-id={bar.id}
                        style={{
                          left: `${placed.left}%`,
                          width: `${placed.width}%`,
                          background: bar.color,
                        }}
                        title={`${bar.label} · ${formatDate(shown.start)} → ${formatDate(shown.end)}`}
                      >
                        {canEdit && (
                          <span
                            className="roadmap-view__handle roadmap-view__handle--start"
                            onPointerDown={(e) => handlePointerDown(e, bar, 'start')}
                            aria-label={`Drag to change ${bar.label} start`}
                            role="slider"
                          />
                        )}
                        <span className="roadmap-view__bar-label">{bar.label}</span>
                        {canEdit && (
                          <span
                            className="roadmap-view__handle roadmap-view__handle--end"
                            onPointerDown={(e) => handlePointerDown(e, bar, 'end')}
                            aria-label={`Drag to change ${bar.label} end`}
                            role="slider"
                          />
                        )}
                      </span>
                    </span>
                  </li>
                );
              })}
              </ul>
            </div>
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
                    <button
                      type="button"
                      key={p.id}
                      className={`roadmap-view__point roadmap-view__point--${p.kind ?? 'milestone'}`}
                      style={{ left: `${pct}%`, background: p.color }}
                      title={`${p.label} · ${formatDate(p.at)}${p.sublabel ? ` · ${p.sublabel}` : ''}`}
                      onClick={() => onPointClick?.(p)}
                      disabled={!onPointClick}
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

// SVG overlay drawing one arrow per { from, to } dependency edge. The arrow
// runs from the right edge of the prerequisite bar to the left edge of the
// dependent bar, routed with a small horizontal-then-vertical-then-horizontal
// kink so arrows in the same column don't overlap. Lane Y is derived from
// the bar's index in the bars array — matches the visual lane order one-to-one.
function DependencyArrows({ bars, dependencies, layout, previewShift }) {
  if (!dependencies || dependencies.length === 0) return null;
  if (bars.length === 0) return null;

  const indexById = new Map(bars.map((b, i) => [b.id, i]));
  const laneCount = bars.length;

  // Lane height matches the CSS: 28px track + 4px top/bottom + s-4 gap. We
  // use a viewBox-relative y so this stays consistent without measuring.
  const laneStep = 100 / laneCount;
  const laneCenter = (i) => i * laneStep + laneStep / 2;

  const arrows = dependencies
    .map(({ from, to }, idx) => {
      const fromBar = bars.find((b) => b.id === from);
      const toBar = bars.find((b) => b.id === to);
      if (!fromBar || !toBar) return null;

      const fromPlaced = layout.placeBar(
        previewShift?.barId === from
          ? { ...fromBar, start: previewShift.start, end: previewShift.end }
          : fromBar);
      const toPlaced = layout.placeBar(
        previewShift?.barId === to
          ? { ...toBar, start: previewShift.start, end: previewShift.end }
          : toBar);
      if (!fromPlaced || !toPlaced) return null;

      const x1 = fromPlaced.left + fromPlaced.width;
      const x2 = toPlaced.left;
      const y1 = laneCenter(indexById.get(from));
      const y2 = laneCenter(indexById.get(to));

      // Cubic curve looks better than orthogonal routing for sparse graphs.
      const dx = Math.max(2, (x2 - x1) / 2);
      const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      return { id: `${from}->${to}-${idx}`, path, x2, y2 };
    })
    .filter(Boolean);

  if (arrows.length === 0) return null;

  return (
    <svg
      className="roadmap-view__deps"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="roadmap-arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" />
        </marker>
      </defs>
      {arrows.map((a) => (
        <path
          key={a.id}
          d={a.path}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="0.3"
          strokeDasharray="0.6 0.4"
          opacity="0.7"
          markerEnd="url(#roadmap-arrowhead)"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function computeLayout(data, zoom) {
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
    ticks: buildTicks(from, to, zoom),
    todayPct,
    placeBar,
    placePoint,
  };
}

// Zoom-aware tick builder. When `zoom` is omitted the original heuristic
// picks the granularity automatically.
function buildTicks(fromMs, toMs, zoom) {
  const span = toMs - fromMs;
  const days = span / 86_400_000;
  const out = [];

  // Honor explicit zoom; otherwise auto-pick by span.
  const mode = zoom === 'w' ? 'week'
    : zoom === 'm' ? 'month'
    : zoom === 'q' ? 'quarter'
    : (days <= 21 ? 'day' : days <= 120 ? 'week' : 'month');

  if (mode === 'day') {
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
  } else if (mode === 'week') {
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
  } else if (mode === 'month') {
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
  } else { // quarter
    const cursor = new Date(fromMs);
    cursor.setDate(1);
    cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= toMs) {
      const pct = ((cursor.getTime() - fromMs) / span) * 100;
      if (pct >= 0 && pct <= 100) {
        const q = Math.floor(cursor.getMonth() / 3) + 1;
        out.push({
          at: cursor.getTime(),
          pct,
          label: `Q${q} ${cursor.getFullYear().toString().slice(2)}`,
        });
      }
      cursor.setMonth(cursor.getMonth() + 3);
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
