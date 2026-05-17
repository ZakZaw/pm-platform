import { useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { useAuthStore } from '@/store/authStore';

/**
 * Opens (and reuses) a SignalR connection to /hubs/project, joins the
 * given project group, and invokes `onEvent(name, payload)` for every
 * server-pushed event.
 *
 * Auth: the @microsoft/signalr client sends the access token on the
 * query string for the WebSocket handshake; backend Program.cs honors
 * that for /hubs/* paths.
 *
 * The connection is rebuilt only if the projectId changes; on unmount or
 * id change the previous group is left and the connection stopped to
 * avoid leaking handlers across pages.
 *
 * Returns `{ status }` where status is one of:
 *   'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
 * Pages can render this for users to spot when live updates are down.
 */
export function useProjectHub(projectId, onEvent) {
  const handlerRef = useRef(onEvent);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!projectId) {
      setStatus('idle');
      return undefined;
    }

    let cancelled = false;
    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/project', {
        accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    // Any event the server emits — we don't enumerate them client-side,
    // since the page handler decides what to do per name.
    connection.on('board.changed', (payload) => handlerRef.current?.('board.changed', payload));
    connection.on('sprint.changed', (payload) => handlerRef.current?.('sprint.changed', payload));

    connection.onreconnecting(() => {
      if (!cancelled) setStatus('reconnecting');
    });
    connection.onreconnected(() => {
      if (!cancelled) {
        setStatus('connected');
        connection.invoke('JoinProject', projectId).catch(() => {});
      }
    });
    connection.onclose(() => {
      if (!cancelled) setStatus('failed');
    });

    setStatus('connecting');
    (async () => {
      try {
        await connection.start();
        if (cancelled) {
          await connection.stop();
          return;
        }
        await connection.invoke('JoinProject', projectId);
        setStatus('connected');
      } catch (err) {
        // SignalR is best-effort UX. A failure here just means no
        // real-time updates; the UI still works via manual refresh.
        console.warn('[useProjectHub] connection failed:', err);
        if (!cancelled) setStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
      if (connection.state !== HubConnectionState.Disconnected) {
        connection.invoke('LeaveProject', projectId).catch(() => {});
        connection.stop().catch(() => {});
      }
    };
  }, [projectId]);

  return { status };
}
