// F2-19 — RRULE helpers shared between RecurrencePicker (which emits
// rules) and the list/detail pages (which render a human label).

const DAY_ALIASES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Tolerant RRULE parser — handles the subset the picker emits, plus
 * any rule that round-trips through "FREQ=...;BYDAY=...". Anything we
 * don't recognise gracefully degrades to "NONE" so the picker doesn't
 * silently misrepresent a stored rule.
 */
export function parseRule(raw) {
  if (!raw) return { freq: 'NONE', byDays: [] };
  const parts = raw.split(';').reduce((acc, kv) => {
    const [k, v] = kv.split('=');
    if (k && v) acc[k.toUpperCase()] = v;
    return acc;
  }, {});
  const freq = parts.FREQ?.toUpperCase();
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') {
    return { freq: 'NONE', byDays: [] };
  }
  const byDays = (parts.BYDAY ?? '')
    .split(',')
    .map((d) => d.trim().toUpperCase())
    .filter((d) => DAY_ALIASES.includes(d));
  return { freq, byDays };
}

/** Render a human-readable label for a stored RRULE (used in lists). */
export function describeRecurrence(rrule) {
  const parsed = parseRule(rrule);
  if (parsed.freq === 'NONE') return null;
  if (parsed.freq === 'DAILY') return 'Daily';
  if (parsed.freq === 'WEEKLY') {
    if (parsed.byDays.length === 0) return 'Weekly';
    return `Weekly · ${parsed.byDays
      .map((d) => DAY_LABELS[DAY_ALIASES.indexOf(d)])
      .join(', ')}`;
  }
  if (parsed.freq === 'MONTHLY') return 'Monthly';
  return rrule;
}

export { DAY_ALIASES, DAY_LABELS };
