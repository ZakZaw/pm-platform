import { useNow } from './useNow';

/**
 * Returns Date.now() that re-renders the caller on a fixed interval,
 * so SLA countdown badges tick live without polling the server. Default
 * cadence is 30s — close enough to "live" for support ops without
 * triggering re-renders every second.
 */
export function useSlaTick(intervalMs = 30_000) {
  return useNow(intervalMs);
}
