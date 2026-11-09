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
