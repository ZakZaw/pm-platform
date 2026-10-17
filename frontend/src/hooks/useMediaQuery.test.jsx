import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery';

function stubMatchMedia(initial) {
  const listeners = new Set();
  const state = { matches: initial };
  window.matchMedia = vi.fn(() => ({
    get matches() { return state.matches; },
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  }));
  return {
    set(value) {
      state.matches = value;
      listeners.forEach((fn) => fn());
    },
    listeners,
  };
}

describe('useMediaQuery', () => {
  const original = window.matchMedia;
  afterEach(() => { window.matchMedia = original; });

  it('reports the current match and follows changes', () => {
    const mq = stubMatchMedia(false);
    const { result, unmount } = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(false);

    act(() => mq.set(true));
    expect(result.current).toBe(true);

    unmount();
    expect(mq.listeners.size).toBe(0);
  });

  it('is false where matchMedia is unavailable', () => {
    window.matchMedia = undefined;
    const { result } = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(false);
  });
});
