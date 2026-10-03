import { useState } from 'react';
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
import { Video } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { meetingsApi } from '@/api/meetings.api';
import './meetingRoom.css';

/**
 * F2-20 — guest landing page. Anonymous: the token in the URL is the
 * credential. The visitor enters their display name once, hits Join,
 * and we exchange that for a LiveKit access token via the public
 * <c>/meetings/guest/{token}/join</c> endpoint.
 */
export function GuestMeetingPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [join, setJoin] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleJoin(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const j = await meetingsApi.joinAsGuest(token, displayName.trim() || null);
      setJoin(j);
    } catch (err) {
      const status = err.response?.status;
      if (status === 410) setError('This invite link has expired. Ask the organiser for a fresh one.');
      else if (status === 404) setError('This invite link is invalid.');
      else if (status === 503) setError('Video is not configured on the server.');
      else setError(err.response?.data?.detail ?? 'Could not join the meeting.');
    } finally {
      setBusy(false);
    }
  }

  if (join) {
    return (
      <div className="mr-shell">
        <header className="mr-head">
          <div>
            <p className="mr-eyebrow"><span className="mr-live-dot" aria-hidden="true" /> Guest · in session</p>
            <h1 className="mr-title">{join.meetingTitle}</h1>
          </div>
          {join.recordingActive && (
            <span className="mr-recording">Recording</span>
          )}
        </header>
        <div className="mr-body">
          <LiveKitRoom
            serverUrl={join.url}
            token={join.token}
            connect
            video
            audio
            data-lk-theme="default"
            onDisconnected={() => navigate('/login')}
            className="mr-livekit"
          >
            <GuestGrid />
            <RoomAudioRenderer />
            <ControlBar variation="verbose" />
          </LiveKitRoom>
        </div>
      </div>
    );
  }

  return (
    <div className="mr-shell mr-shell-error">
      <div className="card mr-panel mr-guest">
        <header className="mr-guest-head">
          <span className="mr-panel-icon"><Video size={22} aria-hidden="true" /></span>
          <h1 className="mr-error-title">Join meeting as guest</h1>
          <p className="muted">Your camera and mic will start when you join.</p>
        </header>
        <form className="mr-guest-form" onSubmit={handleJoin}>
          <Input
            label="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What should we call you?"
            autoFocus
          />
          {error && (
            <p className="mr-guest-error">{error}</p>
          )}
          <div className="mr-guest-actions">
            <Button type="submit" variant="primary" block disabled={busy}>
              {busy ? 'Joining…' : 'Join meeting'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GuestGrid() {
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
