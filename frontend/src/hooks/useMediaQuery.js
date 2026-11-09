import { useSyncExternalStore } from 'react';

/** Phone breakpoint — matches the `max-width: 760px` blocks in stratos.css. */
export const PHONE_QUERY = '(max-width: 760px)';

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 * Falls back to `false` where matchMedia is unavailable (tests, SSR).
 * @param {string} query
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** @returns {boolean} true on phone-width viewports. */
export const useIsPhone = () => useMediaQuery(PHONE_QUERY);
