// Shared helpers for the SVG chart widgets.

/**
 * "Nice" y-axis ticks from 0 to ≥ max, roughly `count` steps, using
 * 1 / 2 / 5 × 10^n step sizes so labels read cleanly (0, 10, 20 …).
 */
export function niceTicks(max, count = 4) {
  const safeMax = Math.max(1, max);
  const raw = safeMax / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(safeMax / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}
