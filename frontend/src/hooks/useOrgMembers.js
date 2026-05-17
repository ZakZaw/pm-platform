import { useEffect, useState } from 'react';
import { orgsApi } from '@/api/orgs.api';

// Module-level cache so multiple pickers on a page share one fetch.
const cache = new Map();
const inflight = new Map();

async function fetchAll(orgSlug) {
  const data = await orgsApi.listMembers(orgSlug, { page: 1, pageSize: 100 });
  return data.items ?? [];
}

/**
 * Loads org members once per slug. Pickers and assignee selectors share
 * this; it intentionally doesn't paginate — at 100 members per org the
 * picker switches to a search input rather than a second page.
 */
export function useOrgMembers(orgSlug) {
  const [state, setState] = useState(() =>
    orgSlug && cache.has(orgSlug)
      ? { members: cache.get(orgSlug), loading: false }
      : { members: [], loading: Boolean(orgSlug) },
  );

  useEffect(() => {
    if (!orgSlug) {
      setState({ members: [], loading: false });
      return undefined;
    }
    if (cache.has(orgSlug)) {
      setState({ members: cache.get(orgSlug), loading: false });
      return undefined;
    }
    let cancelled = false;
    let promise = inflight.get(orgSlug);
    if (!promise) {
      promise = fetchAll(orgSlug);
      inflight.set(orgSlug, promise);
    }
    setState({ members: [], loading: true });
    promise
      .then((list) => {
        cache.set(orgSlug, list);
        inflight.delete(orgSlug);
        if (!cancelled) setState({ members: list, loading: false });
      })
      .catch(() => {
        inflight.delete(orgSlug);
        if (!cancelled) setState({ members: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  return state;
}

export function invalidateOrgMembers(orgSlug) {
  cache.delete(orgSlug);
}
