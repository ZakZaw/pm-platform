/**
 * Module-level cache for the F2-18 chat `[[task:KEY]]` embeds. Kept in
 * its own file so the React component module only exports a component
 * (keeps the Vite fast-refresh contract clean).
 */

export const cache = new Map(); // key -> { task, fetchedAt }
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Bust a cached task lookup so every visible embed refetches. */
export function invalidateTaskEmbed(key) {
  const normalised = key.toUpperCase();
  cache.delete(normalised);
  listeners.forEach((fn) => fn(normalised));
}
