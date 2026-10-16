// Pure formatters for dashboard KPI tiles (personal /home + org home strip).
// Every helper renders an em dash for missing data so tiles never show NaN.

export const DASH = '—';

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** Compact currency: $1.3M / $14K / $850. Falls back to a plain $ prefix. */
export function formatCompactMoney(value, currency = 'USD') {
  if (!isNum(value)) return DASH;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `$${Math.round(value)}`;
  }
}

/** Number with at most one decimal: 38 / 2.8. */
export function formatNumber(value, { suffix = '' } = {}) {
  if (!isNum(value)) return DASH;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}${suffix}`;
}

/** Signed delta: "+12", "−0.4d", "±0". Returns null when there's no delta. */
export function formatSigned(value, suffix = '') {
  if (!isNum(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return `±0${suffix}`;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}${suffix}`;
}

/** Whole percent: "94%". */
export function formatPct(value) {
  if (!isNum(value)) return DASH;
  return `${Math.round(value)}%`;
}

/** Delta class for `.stat-delta`: good news → up (green), bad → down (red). */
export function deltaClass(good) {
  return good ? 'stat-delta-up' : 'stat-delta-down';
}
