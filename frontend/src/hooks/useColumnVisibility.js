import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

/**
 * Tracks which workflow statuses are visible in a column view. Persists
 * per-user (via the auth-store userId) in localStorage, scoped to a
 * caller-chosen key (e.g. "board:projectId" or "workflow:projectId").
 *
 * When the user has no saved preference, every status is visible by
 * default. Pass `defaultStatuses` so first-render visibility matches the
 * current workflow even before any save.
 *
 * Returns { visible: Set<string>, toggle, setVisible, isVisible }.
 */
export function useColumnVisibility(scope, defaultStatuses = []) {
  const userId = useAuthStore((s) => s.user?.id);
  const storageKey = userId && scope ? `pm:cols:${userId}:${scope}` : null;

  const [visible, setVisibleState] = useState(() => new Set(defaultStatuses));

  // Hydrate from storage when the key becomes available, or fall back
  // to defaultStatuses on first mount. We rehydrate when `scope` changes
  // so swapping projects doesn't leak settings.
  useEffect(() => {
    if (!storageKey) {
      setVisibleState(new Set(defaultStatuses));
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          setVisibleState(new Set(arr));
          return;
        }
      }
    } catch {
      /* malformed value — fall through to defaults */
    }
    setVisibleState(new Set(defaultStatuses));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, defaultStatuses.join(',')]);

  const setVisible = useCallback(
    (nextSet) => {
      setVisibleState(nextSet);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify([...nextSet]));
        } catch {
          /* storage full / private mode — give up silently */
        }
      }
    },
    [storageKey],
  );

  const toggle = useCallback(
    (status) => {
      const next = new Set(visible);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      setVisible(next);
    },
    [visible, setVisible],
  );

  const isVisible = useCallback((status) => visible.has(status), [visible]);

  return { visible, toggle, setVisible, isVisible };
}
