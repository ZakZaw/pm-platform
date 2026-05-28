import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '@/store/authStore';

/**
 * F2-21 — subscribe to meeting-scoped SignalR events. Currently
 * fanned out: <c>meeting.transcript_segment</c>. Future events
 * (presence, hand-raise) slot in here.
 *
 * Mirrors useChannelRealtime — handlers ref means consumers can pass
 * an inline object without tearing down the connection on every
 * render.
 */
export function useMeetingRealtime(meetingId, handlers) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!meetingId || !accessToken) return undefined;

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

    connection.onreconnected(() => {
      connection.invoke('JoinMeeting', meetingId).catch(() => {});
    });

    let cancelled = false;
    connection.start()
      .then(() => {
        if (cancelled) return;
        return connection.invoke('JoinMeeting', meetingId);
      })
      .catch(() => { /* non-fatal */ });

    return () => {
      cancelled = true;
      if (connection.state !== signalR.HubConnectionState.Disconnected) {
        connection.invoke('LeaveMeeting', meetingId).catch(() => {});
      }
      connection.stop().catch(() => {});
    };
  }, [meetingId, accessToken]);
}
