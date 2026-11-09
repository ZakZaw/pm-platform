import { useCallback, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

function readVisible(storageKey, defaultStatuses) {
  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {
      /* malformed value — fall through to defaults */
    }
  }
  return new Set(defaultStatuses);
}

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

  // Hydrate from storage when the key becomes available, or fall back to
  // defaultStatuses. We rehydrate (during render) when the key or the
  // default list changes so swapping projects doesn't leak settings.
  const hydrateKey = `${storageKey ?? ''}|${defaultStatuses.join(',')}`;
  const [visible, setVisibleState] = useState(() => readVisible(storageKey, defaultStatuses));
  const [hydratedFor, setHydratedFor] = useState(hydrateKey);
  if (hydrateKey !== hydratedFor) {
    setHydratedFor(hydrateKey);
    setVisibleState(readVisible(storageKey, defaultStatuses));
  }

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
