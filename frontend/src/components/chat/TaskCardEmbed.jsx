import { useEffect, useState } from 'react';
import { Priority, StatusBadge } from '@/components/ui';
import { tasksApi } from '@/api/tasks.api';
import { cache, subscribe } from './taskEmbedCache';

/**
 * Inline mini task card rendered for `[[task:KEY]]` tokens in a chat
 * message body. The widget hydrates from the per-org task-by-key
 * endpoint and shares a module-level cache (see `taskEmbedCache.js`)
 * so the same key referenced in twenty messages only fetches once.
 *
 * Live updates: each card subscribes to the cache invalidation hook;
 * when a task changes (via SignalR or any in-app mutation) its cache
 * entry is bumped and every visible embed re-fetches.
 */
export function TaskCardEmbed({ taskKey, orgSlug }) {
  const normalised = taskKey.toUpperCase();

  const [task, setTask] = useState(() => cache.get(normalised)?.task ?? null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => subscribe((changedKey) => {
    if (changedKey === normalised) setVersion((v) => v + 1);
  }), [normalised]);

  useEffect(() => {
    if (!orgSlug) return undefined;
    let cancelled = false;
    (async () => {
      if (cache.has(normalised)) {
        setTask(cache.get(normalised).task);
        return;
      }
      try {
        const t = await tasksApi.getByKey(orgSlug, normalised);
        cache.set(normalised, { task: t, fetchedAt: Date.now() });
        if (!cancelled) {
          setTask(t);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.status === 404 ? 'not-found' : 'error');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, normalised, version]);

  if (error === 'not-found') {
    return <span className="msg-task-embed-missing">[[task:{normalised}]]</span>;
  }
  if (!task) {
    return <span className="msg-task-embed-loading">{normalised}…</span>;
  }

  return (
    <span className="msg-task-embed" title={task.title}>
      <span className="msg-task-embed-key">{task.key}</span>
      <span className="msg-task-embed-title">{task.title}</span>
      <StatusBadge status={task.status} />
      <Priority level={task.priority} />
    </span>
  );
}
