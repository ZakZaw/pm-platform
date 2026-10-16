// Marketing channel → `.mkt-ch-*` class (see channel.css). Sets the --ch /
// --ch-bg custom properties so dots, bars and text can pick up the channel
// colour without inline styles.
const KNOWN = new Set(['email', 'social', 'blog', 'paid', 'event']);

export function channelClass(channel) {
  const k = String(channel ?? '').toLowerCase();
  return `mkt-ch-${KNOWN.has(k) ? k : 'other'}`;
}

export const CAMPAIGN_STATUS_CLASS = {
  Planning: 'status-todo',
  Active: 'status-progress',
  Completed: 'status-done',
  Archived: 'status-todo',
};
