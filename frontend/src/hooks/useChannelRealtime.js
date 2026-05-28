import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '@/store/authStore';

/**
 * Subscribe to channel-scoped chat events (F2-18). Opens a connection
 * to /hubs/project, joins the per-channel group, and dispatches every
 * event by name to the handler map.
 *
 * Mirrors `useProjectRealtime`'s shape — handlers ref means consumers
 * can pass an inline object without tearing down the connection on
 * every render. Event names live in
 * <c>Application.Interfaces.ChannelEvents</c>.
 */
export function useChannelRealtime(channelId, handlers) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!channelId || !accessToken) return undefined;

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

    // Rejoin the channel after every automatic reconnect — SignalR's
    // group memberships don't survive a reconnect.
    connection.onreconnected(() => {
      connection.invoke('JoinChannel', channelId).catch(() => {});
    });

    let cancelled = false;
    connection.start()
      .then(() => {
        if (cancelled) return;
        return connection.invoke('JoinChannel', channelId);
      })
      .catch(() => {
        // Non-fatal — feed still works through manual fetches.
      });

    return () => {
      cancelled = true;
      if (connection.state !== signalR.HubConnectionState.Disconnected) {
        connection.invoke('LeaveChannel', channelId).catch(() => {});
      }
      connection.stop().catch(() => {});
    };
  }, [channelId, accessToken]);
}
