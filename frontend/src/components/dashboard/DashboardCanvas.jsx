import { useMemo } from 'react';
import { Responsive, useContainerWidth } from 'react-grid-layout';
import { X } from 'lucide-react';
import 'react-grid-layout/css/styles.css';
import './DashboardCanvas.css';

const COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const ROW_HEIGHT = 56;

/**
 * Generic dashboard canvas. Accepts a widget registry + the current layout
 * + a callback. The layout is the source of truth; the canvas just renders
 * what's in it. Widgets not in the layout are not rendered — the page
 * controls visibility by adding/removing entries.
 *
 * Widget registry entry shape:
 *   { id, title, defaults: { w, h, minW?, minH?, maxH? }, render: (ctx) => JSX }
 *
 * Layout entry shape (react-grid-layout):
 *   { i: widgetId, x, y, w, h, minW?, minH?, maxH? }
 */
export function DashboardCanvas({
  registry,
  layout,
  onLayoutChange,
  editing,
  onRemove,
  ctx = {},
}) {
  // Map widget id → registry entry for quick lookup.
  const byId = useMemo(() => Object.fromEntries(registry.map((w) => [w.id, w])), [registry]);

  // Only render widgets that are both in the layout AND known to the registry.
  // Stale entries (e.g. a renamed widget) are silently skipped — they get
  // cleaned up when the user next saves the layout.
  const items = layout.filter((it) => byId[it.i]);

  // react-grid-layout v2 dropped WidthProvider; this hook is the
  // replacement — gives us a containerRef + measured width to pass to
  // Responsive directly.
  const { containerRef, width } = useContainerWidth({ initialWidth: 1200 });

  return (
    <div ref={containerRef} className={`dashboard-canvas ${editing ? 'is-editing' : ''}`}>
    <Responsive
      width={width}
      layouts={{ lg: items }}
      cols={COLS}
      breakpoints={BREAKPOINTS}
      rowHeight={ROW_HEIGHT}
      margin={[12, 12]}
      containerPadding={[0, 0]}
      isDraggable={editing}
      isResizable={editing}
      draggableHandle=".dash-canvas-widget__drag"
      onLayoutChange={(next) => onLayoutChange(next)}
      compactType="vertical"
    >
      {items.map((it) => {
        const widget = byId[it.i];
        return (
          <div key={it.i} className="dash-canvas-widget" data-widget-id={it.i}>
            {editing && (
              <>
                <div className="dash-canvas-widget__drag" aria-label="Drag" />
                <button
                  type="button"
                  className="dash-canvas-widget__remove"
                  onClick={() => onRemove(it.i)}
                  aria-label={`Remove ${widget.title}`}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </>
            )}
            <div className="dash-canvas-widget__body">
              {widget.render({ ...ctx, editing })}
            </div>
          </div>
        );
      })}
    </Responsive>
    </div>
  );
}

/**
 * Returns the default layout — every widget in the registry placed in a
 * sensible reading order. Used when the user has no saved layout or asks
 * to reset.
 */
export function defaultLayout(registry) {
  let x = 0;
  let y = 0;
  return registry.map((w) => {
    const { w: ww, h: wh, minW, minH, maxH } = w.defaults;
    // Wrap to next row when we'd overflow the 12-col grid.
    if (x + ww > 12) {
      x = 0;
      y += 1;
    }
    const item = { i: w.id, x, y, w: ww, h: wh };
    if (minW != null) item.minW = minW;
    if (minH != null) item.minH = minH;
    if (maxH != null) item.maxH = maxH;
    x += ww;
    return item;
  });
}
