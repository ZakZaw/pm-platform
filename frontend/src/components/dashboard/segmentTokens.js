// Theme-aware palette for stacked-bar / legend segments. Token references
// (not hex) so the swatches track light/dark and the design system — cycle
// through it with `SEGMENT_TOKENS[i % SEGMENT_TOKENS.length]`. Accent leads;
// the rest are the calmer categorical hues.
export const SEGMENT_TOKENS = [
  'var(--accent)',
  'var(--teal)',
  'var(--violet)',
  'var(--amber)',
  'var(--info)',
  'var(--rose)',
  'var(--success)',
  'var(--warning)',
];
