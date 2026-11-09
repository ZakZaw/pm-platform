import { describe, it, expect, vi } from 'vitest';
import { refreshAcrossTabs, REFRESH_LOCK } from './refreshCoordinator';

function fakeStore(token) {
  const state = { refreshToken: token, refresh: vi.fn(async () => { state.refreshToken = 'rotated'; }) };
  return { state, store: { getState: () => state, persist: { rehydrate: vi.fn() } } };
}

describe('refreshAcrossTabs', () => {
  it('refreshes when the stored token is still the stale one', async () => {
    const { state, store } = fakeStore('t1');
    await refreshAcrossTabs(store, 't1', undefined);
    expect(state.refresh).toHaveBeenCalledTimes(1);
    expect(store.persist.rehydrate).toHaveBeenCalled();
  });

  it('adopts a token another tab already rotated instead of refreshing again', async () => {
    const { state, store } = fakeStore('t2');
    await refreshAcrossTabs(store, 't1', undefined);
    expect(state.refresh).not.toHaveBeenCalled();
  });

  it('fails when another tab signed out', async () => {
    const { store } = fakeStore(null);
    await expect(refreshAcrossTabs(store, 't1', undefined)).rejects.toThrow('Signed out');
  });

  it('runs inside the shared Web Lock so tabs refresh one at a time', async () => {
    const { state, store } = fakeStore('t1');
    const locks = { request: vi.fn((name, cb) => cb()) };
    await refreshAcrossTabs(store, 't1', locks);
    expect(locks.request).toHaveBeenCalledWith(REFRESH_LOCK, expect.any(Function));
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });

  it('serialises concurrent refreshes: the second caller sees the rotated token', async () => {
    const { state, store } = fakeStore('t1');
    let chain = Promise.resolve();
    const locks = { request: (name, cb) => (chain = chain.then(cb)) };
    await Promise.all([refreshAcrossTabs(store, 't1', locks), refreshAcrossTabs(store, 't1', locks)]);
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });
});
