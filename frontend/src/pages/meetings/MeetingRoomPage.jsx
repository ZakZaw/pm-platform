import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { Circle, MessageSquare, X } from 'lucide-react';
import { Badge, Button, Skeleton, useToast } from '@/components/ui';
import { meetingsApi } from '@/api/meetings.api';
import './meetingRoom.css';

/**
 * F2-20 — built-in video room. Auth path: the project member POSTs
 * to <c>/meetings/{id}/join</c> to get a short-lived LiveKit token,
 * then we hand it to <c>LiveKitRoom</c> which negotiates the WSS
 * connection. Side panel slots: chat + transcript stubs (live links
 * in F2-18 / F2-21).
 */
export function MeetingRoomPage() {
  const { slug: orgSlug, projectSlug, meetingId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [join, setJoin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidePanel, setSidePanel] = useState('none'); // 'none' | 'chat' | 'transcript'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const j = await meetingsApi.join(meetingId);
        if (!cancelled) setJoin(j);
      } catch (err) {
        if (!cancelled) {
          const status = err.response?.status;
          const detail = err.response?.data?.detail;
          if (status === 503) setError('Video is not configured on the server.');
          else setError(detail ?? 'Could not join the meeting.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [meetingId]);

  function leave() {
    navigate(`/${orgSlug}/projects/${projectSlug}/meetings/${meetingId}`);
  }

  if (loading) {
    return (
      <div className="mr-shell mr-shell-loading">
        <Skeleton height={400} radius="lg" />
      </div>
    );
  }
  if (error || !join) {
    return (
      <div className="mr-shell mr-shell-error">
        <h1 className="mr-error-title">Can't enter the room</h1>
        <p className="muted">{error ?? 'No token returned.'}</p>
        <Button variant="primary" onClick={leave}>Back to meeting</Button>
      </div>
    );
  }

  return (
    <MeetingRoomInner
      join={join}
      sidePanel={sidePanel}
      onSidePanelChange={setSidePanel}
      onLeave={leave}
      onToast={toast}
    />
  );
}

function MeetingRoomInner({ join, sidePanel, onSidePanelChange, onLeave, onToast }) {
  return (
    <div className="mr-shell">
      <header className="mr-head">
        <div>
          <p className="mr-eyebrow">In session</p>
          <h1 className="mr-title">{join.meetingTitle}</h1>
        </div>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          {join.recordingActive && (
            <Badge tone="danger">
              <Circle size={9} fill="currentColor" aria-hidden="true" /> Recording
            </Badge>
          )}
          <Button
            variant={sidePanel === 'chat' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onSidePanelChange(sidePanel === 'chat' ? 'none' : 'chat')}
          >
            <MessageSquare size={12} aria-hidden="true" /> Chat
          </Button>
          <Button
            variant={sidePanel === 'transcript' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onSidePanelChange(sidePanel === 'transcript' ? 'none' : 'transcript')}
          >
            Transcript
          </Button>
        </div>
      </header>

      <div className={['mr-body', sidePanel !== 'none' && 'mr-body-with-aside']
        .filter(Boolean).join(' ')}>
        <LiveKitRoom
          serverUrl={join.url}
          token={join.token}
          connect
          video
          audio
          data-lk-theme="default"
          onDisconnected={() => {
            onToast.show({ tone: 'info', message: 'You left the meeting.' });
            onLeave();
          }}
          onError={(err) => {
            onToast.show({
              tone: 'danger',
              message: err?.message ?? 'Connection lost.',
            });
          }}
          className="mr-livekit"
        >
          <ParticipantsGrid />
          <RoomAudioRenderer />
          <ControlBar variation="verbose" />
        </LiveKitRoom>

        {sidePanel !== 'none' && (
          <aside className="mr-aside">
            <header className="mr-aside-head">
              <h2 className="mr-aside-title">
                {sidePanel === 'chat' ? 'Chat' : 'Live transcript'}
              </h2>
              <button
                type="button"
                className="mr-aside-close"
                onClick={() => onSidePanelChange('none')}
                aria-label="Close side panel"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </header>
            <div className="mr-aside-body">
              {sidePanel === 'chat' ? (
                <p className="muted">In-room chat wires up with F2-18 channels.</p>
              ) : (
                <p className="muted">Live speaker-labelled transcript lands in F2-21.</p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * Renders one tile per published camera + screen-share track via
 * LiveKit's built-in <ParticipantTile> — keeps the layout consistent
 * with what users already expect from Meet / Zoom.
 */
function ParticipantsGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false });
  return (
    <GridLayout tracks={tracks} className="mr-grid">
      <ParticipantTile />
    </GridLayout>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { MeetingRoomInner };
