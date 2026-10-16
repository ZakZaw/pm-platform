// Cross-tab refresh coordination.
//
// The API revokes a whole refresh-token family when a rotated token is
// presented again (reuse detection, M3). Two tabs that hit a 401 at the same
// moment would both send the same refresh token — the second looks like reuse
// and logs the user out everywhere. So refreshes are serialised across tabs
// with the Web Locks API, and a tab that waited re-reads the persisted session
// first: if another tab already rotated the token it just adopts the result.

export const REFRESH_LOCK = 'pm-auth-refresh';

/**
 * @param {{ getState: () => { refreshToken: string|null, refresh: () => Promise<void> },
 *           persist?: { rehydrate?: () => Promise<void> | void } }} store
 * @param {string|null} staleRefreshToken the refresh token that was current when the 401 happened
 * @param {{ request?: (name: string, cb: () => Promise<void>) => Promise<void> } | undefined} locks
 */
export async function refreshAcrossTabs(store, staleRefreshToken, locks = globalThis.navigator?.locks) {
  const run = async () => {
    await store.persist?.rehydrate?.();
    const current = store.getState().refreshToken;
    if (!current) throw new Error('Signed out');
    if (current !== staleRefreshToken) return; // another tab already refreshed
    await store.getState().refresh();
  };
  return locks?.request ? locks.request(REFRESH_LOCK, run) : run();
}

/** Keep every tab's in-memory session in step with localStorage (refresh + logout). */
export function syncAuthAcrossTabs(store, storageKey) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e) => {
    if (e.key === storageKey) store.persist?.rehydrate?.();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
