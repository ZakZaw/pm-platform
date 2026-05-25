import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '@/store/authStore';

/**
 * Subscribe to user-scoped SignalR events (notifications, etc). Unlike
 * useProjectRealtime, this hook does not call JoinProject — the hub auto-
 * routes user pushes via SignalR's Clients.User mapping, which works as
 * soon as the connection is authenticated.
 *
 * Event names live in backend Application.Interfaces.UserEvents
 * ('notification.arrived'). Pass a map of `eventName -> handler`.
 */
export function useUserRealtime(handlers) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!accessToken) return undefined;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`/hubs/project?access_token=${encodeURIComponent(accessToken)}`)
      .withAutomaticReconnect()
      .build();

    const eventNames = Object.keys(handlersRef.current ?? {});
    for (const name of eventNames) {
      connection.on(name, (payload) => {
        handlersRef.current?.[name]?.(payload);
      });
    }

    connection.start().catch(() => {
      // Server unreachable — non-fatal; the topbar still works without
      // realtime notification pushes (polling on open covers the gap).
    });

    return () => {
      connection.stop().catch(() => {});
    };
  }, [accessToken]);
}
