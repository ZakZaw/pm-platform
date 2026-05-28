import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Mic, MicOff } from 'lucide-react';
import { Badge, Button, useToast } from '@/components/ui';
import { meetingsApi } from '@/api/meetings.api';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useMeetingRealtime } from '@/hooks/useMeetingRealtime';
import { useAuthStore } from '@/store/authStore';
import './transcriptPanel.css';

/**
 * F2-21 — live speaker-labelled transcript panel. Renders inside the
 * meeting room's side panel slot. Each authenticated participant runs
 * Web Speech API locally, POSTs final segments to the backend, and
 * everyone in the meeting:{id} SignalR group sees them appear within
 * the AC's 2s window.
 *
 * Speaker label is the participant's display name (LiveKit identity
 * convention <c>u:{userId}</c>) — matches the AC's "accurate without
 * voice diarisation" requirement.
 */
export function TranscriptPanel({ meetingId, isGuest = false }) {
  const toast = useToast();
  const me = useAuthStore((s) => s.user);

  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const scrollerRef = useRef(null);
  const stickToBottomRef = useRef(true);

  // Hydrate the back-history so a late joiner sees everything said
  // before their browser opened the panel.
  useEffect(() => {
    if (!meetingId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const t = await meetingsApi.getTranscript(meetingId);
        if (!cancelled) setSegments(t.segments ?? []);
      } catch {
        if (!cancelled) setSegments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [meetingId]);

  const handleSegment = useCallback((payload) => {
    if (!payload?.text) return;
    setSegments((cur) => [...cur, payload]);
  }, []);

  useMeetingRealtime(meetingId, {
    'meeting.transcript_segment': handleSegment,
  });

  // Auto-scroll only when the user is pinned to the bottom (so a
  // reader scrolling the back-history doesn't get yanked away).
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollerRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [segments]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  // Outgoing path: Web Speech API → POST → SignalR fan-out. Guests
  // (anonymous tokens) can't post; the panel still receives.
  const { supported, listening, error, start, stop } = useSpeechRecognition({
    onFinalSegment: async (frag) => {
      try {
        await meetingsApi.postTranscriptSegment(meetingId, frag);
      } catch (err) {
        toast.show({
          tone: 'danger',
          message: err.response?.data?.detail ?? 'Could not send transcript.',
        });
      }
    },
  });

  async function download(format) {
    setDownloading(true);
    try {
      const { blob, headers } = await meetingsApi.downloadTranscript(meetingId, format);
      const disposition = headers?.['content-disposition'] ?? '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const fileName = match?.[1] ?? `transcript.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not download transcript.',
      });
    } finally {
      setDownloading(false);
    }
  }

  const grouped = useMemo(() => groupBySpeaker(segments), [segments]);

  return (
    <div className="tp-shell">
      <header className="tp-head">
        <div className="row gap-2">
          {listening
            ? <Badge tone="success"><Mic size={10} aria-hidden="true" /> Listening</Badge>
            : <Badge tone="neutral"><MicOff size={10} aria-hidden="true" /> Off</Badge>}
        </div>
        <div className="row gap-2">
          {!isGuest && supported && (
            <Button
              type="button"
              size="sm"
              variant={listening ? 'ghost' : 'primary'}
              onClick={listening ? stop : start}
            >
              {listening ? 'Stop' : 'Caption me'}
            </Button>
          )}
        </div>
      </header>

      <div ref={scrollerRef} className="tp-scroll" onScroll={onScroll}>
        {loading && <p className="muted tp-empty">Loading transcript…</p>}
        {!loading && segments.length === 0 && (
          <p className="muted tp-empty">
            No transcript yet. {supported ? 'Hit "Caption me" to start.' : ''}
          </p>
        )}
        {grouped.map((group, idx) => (
          <article key={`${group.identity}-${idx}`} className="tp-group">
            <header className="tp-group-head">
              <span className="tp-speaker">{group.displayName}</span>
              <time className="tp-time">
                {new Date(group.startedAt).toLocaleTimeString([], {
                  hour: 'numeric', minute: '2-digit',
                })}
              </time>
            </header>
            {group.lines.map((line, lineIdx) => (
              <p key={lineIdx} className="tp-line">{line.text}</p>
            ))}
          </article>
        ))}
      </div>

      <footer className="tp-foot">
        <Button size="sm" variant="ghost" onClick={() => download('txt')} disabled={downloading}>
          <Download size={11} aria-hidden="true" /> .txt
        </Button>
        <Button size="sm" variant="ghost" onClick={() => download('vtt')} disabled={downloading}>
          <Download size={11} aria-hidden="true" /> .vtt
        </Button>
        {!supported && !isGuest && (
          <span className="muted tp-warning">
            Speech-to-text isn't supported in this browser — try Chrome or Edge.
          </span>
        )}
        {error && <span className="tp-warning">Recognition error: {error}</span>}
      </footer>
    </div>
  );
}

function groupBySpeaker(segments) {
  const groups = [];
  for (const s of segments) {
    const tail = groups[groups.length - 1];
    if (tail && tail.identity === s.identity) {
      tail.lines.push(s);
    } else {
      groups.push({
        identity: s.identity,
        displayName: s.displayName,
        startedAt: s.startedAt,
        lines: [s],
      });
    }
  }
  return groups;
}
