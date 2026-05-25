import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '@/store/authStore';

/**
 * Subscribe to project-scoped SignalR events. Pass a map of `eventName ->
 * handler` and the connection is built (or reused) for the lifetime of the
 * component. Handlers are fired with whatever payload the server sent.
 *
 * Event names live in backend Application.Interfaces.ProjectEvents — the
 * canonical strings are 'board.changed', 'sprint.changed', 'comment.added',
 * 'epic.dates_changed', 'milestone.created', etc.
 */
export function useProjectRealtime(projectId, handlers) {
  const accessToken = useAuthStore((s) => s.accessToken);
  // Store handlers in a ref so consumers can pass inline objects without
  // tearing down the connection on every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!projectId || !accessToken) return undefined;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`/hubs/project?access_token=${encodeURIComponent(accessToken)}`)
      .withAutomaticReconnect()
      .build();

    // Bind every event name once; the ref indirection lets us swap
    // handlers without rebuilding.
    const eventNames = Object.keys(handlersRef.current ?? {});
    for (const name of eventNames) {
      connection.on(name, (payload) => {
        handlersRef.current?.[name]?.(payload);
      });
    }

    let cancelled = false;
    connection.start()
      .then(() => {
        if (cancelled) return;
        return connection.invoke('JoinProject', projectId);
      })
      .catch(() => {
        // Server unreachable — non-fatal; the page still works without
        // real-time updates.
      });

    return () => {
      cancelled = true;
      connection.stop().catch(() => {});
    };
  }, [projectId, accessToken]);
}
