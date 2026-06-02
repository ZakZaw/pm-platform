import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Link as LinkIcon,
  Repeat,
  Sparkles,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Input,
  Skeleton,
  useToast,
} from '@/components/ui';
import { meetingsApi } from '@/api/meetings.api';
import { useAuthStore } from '@/store/authStore';
import { describeRecurrence } from '@/components/meetings/recurrence';
import '@/components/meetings/meetings.css';

const TYPE_TONES = {
  Standup: 'info',
  Planning: 'purple',
  Review: 'success',
  Retrospective: 'warning',
  OneOnOne: 'neutral',
  Other: 'neutral',
};

const RSVP_OPTIONS = [
  { value: 'Accepted', label: 'Accept', icon: Check, tone: 'success' },
  { value: 'Tentative', label: 'Maybe', icon: Clock, tone: 'warning' },
  { value: 'Declined', label: 'Decline', icon: X, tone: 'danger' },
];

/**
 * F2-19 — meeting detail. Shows the schedule, attendees, agenda, and
 * RSVP controls. Organisers get inline cancel; everyone on the invite
 * list gets the RSVP buttons. Agenda is editable inline until the
 * meeting starts.
 */
export function MeetingDetailPage() {
  const { slug: orgSlug, projectSlug, meetingId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const me = useAuthStore((s) => s.user);

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agendaDraft, setAgendaDraft] = useState('');
  const [editingAgenda, setEditingAgenda] = useState(false);
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState(false);

  const refresh = useCallback(async () => {
    const m = await meetingsApi.get(meetingId);
    setMeeting(m);
    setAgendaDraft(m.agendaMd ?? '');
  }, [meetingId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  async function rsvp(response) {
    if (!meeting) return;
    setRsvpBusy(true);
    try {
      const m = await meetingsApi.rsvp(meeting.id, response);
      setMeeting(m);
      toast.show({ tone: 'success', message: 'Response saved.' });
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Could not save response.';
      toast.show({ tone: 'danger', message: msg });
    } finally {
      setRsvpBusy(false);
    }
  }

  async function saveAgenda() {
    if (!meeting) return;
    setSavingAgenda(true);
    try {
      const m = await meetingsApi.update(meeting.id, {
        agendaMd: agendaDraft.trim() || null,
        clearAgenda: !agendaDraft.trim(),
        agendaFromAi: false,
      });
      setMeeting(m);
      setEditingAgenda(false);
      toast.show({ tone: 'success', message: 'Agenda saved.' });
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Could not save agenda.';
      toast.show({ tone: 'danger', message: msg });
    } finally {
      setSavingAgenda(false);
    }
  }

  async function cancelMeeting() {
    if (!meeting) return;
    if (!confirm('Cancel this meeting? Attendees will get a cancellation email.')) return;
    try {
      await meetingsApi.cancel(meeting.id);
      toast.show({ tone: 'success', message: 'Meeting cancelled.' });
      navigate(`/${orgSlug}/projects/${projectSlug}/meetings`);
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Could not cancel.';
      toast.show({ tone: 'danger', message: msg });
    }
  }

  // All hooks must run on every render — keep them above the early
  // returns. Each memo guards against `meeting` being null so the
  // initial loading render doesn't trip.
  const start = useMemo(
    () => (meeting ? new Date(meeting.scheduledAt) : null),
    [meeting]);
  const end = useMemo(
    () => (start && meeting ? new Date(start.getTime() + meeting.durationMinutes * 60_000) : null),
    [start, meeting]);
  const isOrganiser = !!meeting && meeting.organizerId === me?.id;
  // Scheduled (room opens 15 min ahead) and InProgress (instant meeting
  // already running) are both joinable / finalisable / cancellable.
  const isLive = !!meeting && (meeting.status === 'Scheduled' || meeting.status === 'InProgress');
  const myAttendance = meeting?.attendees.find((a) => a.userId === me?.id);
  // AC: "Agenda editable up to meeting start time."
  const { canRsvp, canEditAgenda } = useMemo(() => {
    if (!meeting || !start) return { canRsvp: false, canEditAgenda: false };
    const futureSlot = start.getTime() > Date.now() && meeting.status === 'Scheduled';
    return {
      canRsvp: !!myAttendance && futureSlot,
      canEditAgenda: isOrganiser && futureSlot,
    };
  }, [meeting, start, myAttendance, isOrganiser]);

  if (loading && !meeting) {
    return <div className="main-inner"><Skeleton height={400} radius="lg" /></div>;
  }
  if (!meeting || !start || !end) {
    return <div className="main-inner"><p className="muted">Meeting not found.</p></div>;
  }

  const recurrenceLabel = describeRecurrence(meeting.recurrenceRule);

  return (
    <div className="main-inner">
      <header className="page-head">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">{meeting.projectName} · Meetings</p>
            <h1 className="page-title">{meeting.title}</h1>
            <div className="row gap-2" style={{ marginTop: 'var(--s-2)', flexWrap: 'wrap' }}>
              <Badge tone={TYPE_TONES[meeting.type] ?? 'neutral'}>{meeting.type}</Badge>
              {meeting.status === 'InProgress' ? (
                <Badge tone="warning" dot>Live now</Badge>
              ) : meeting.status !== 'Scheduled' && (
                <Badge tone={meeting.status === 'Cancelled' ? 'danger' : 'neutral'}>
                  {meeting.status}
                </Badge>
              )}
              {recurrenceLabel && (
                <Badge tone="purple">
                  <Repeat size={10} aria-hidden="true" /> {recurrenceLabel}
                </Badge>
              )}
            </div>
          </div>
          <div className="row gap-2">
            {isLive && (
              <Button
                variant="primary"
                onClick={() =>
                  navigate(`/${orgSlug}/projects/${projectSlug}/meetings/${meeting.id}/room`)
                }
              >
                <Video size={12} aria-hidden="true" />
                {meeting.status === 'InProgress' ? ' Rejoin meeting' : ' Join meeting'}
              </Button>
            )}
            {isOrganiser && isLive && (
              <FinaliseButton
                meetingId={meeting.id}
                onFinalised={async () => {
                  await refresh();
                  navigate(`/${orgSlug}/projects/${projectSlug}/meetings/${meeting.id}/summary`);
                }}
              />
            )}
            {meeting.status === 'Completed' && (
              <Button
                variant="primary"
                onClick={() =>
                  navigate(`/${orgSlug}/projects/${projectSlug}/meetings/${meeting.id}/summary`)
                }
              >
                <Sparkles size={12} aria-hidden="true" /> View summary
              </Button>
            )}
            {isOrganiser && isLive && (
              <Button variant="ghost" onClick={cancelMeeting}>
                <Trash2 size={12} aria-hidden="true" /> Cancel meeting
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="meeting-detail-grid">
        <section className="meeting-detail-card">
          <div className="row between">
            <h2>Agenda</h2>
            {canEditAgenda && !editingAgenda && (
              <Button size="sm" variant="ghost" onClick={() => setEditingAgenda(true)}>
                Edit
              </Button>
            )}
          </div>
          {editingAgenda ? (
            <>
              <textarea
                className="meeting-agenda-textarea"
                value={agendaDraft}
                onChange={(e) => setAgendaDraft(e.target.value)}
                autoFocus
              />
              <div className="row gap-2">
                <Button size="sm" variant="ghost" onClick={() => {
                  setAgendaDraft(meeting.agendaMd ?? '');
                  setEditingAgenda(false);
                }}>Cancel</Button>
                <Button size="sm" variant="primary" onClick={saveAgenda} disabled={savingAgenda}>
                  {savingAgenda ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </>
          ) : meeting.agendaMd ? (
            <pre className="meeting-agenda-body">{meeting.agendaMd}</pre>
          ) : (
            <p className="muted">No agenda yet.</p>
          )}
          {meeting.agendaFromAi && meeting.agendaMd && (
            <p className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Drafted by AI.</p>
          )}
        </section>

        <section className="meeting-detail-card">
          <h2>Schedule</h2>
          <div className="row gap-2" style={{ alignItems: 'baseline' }}>
            <Calendar size={13} aria-hidden="true" color="var(--text-muted)" />
            <span>
              {start.toLocaleString([], {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
              {' '}–{' '}
              {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              {' '}({meeting.durationMinutes} min)
            </span>
          </div>
          {meeting.description && (
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{meeting.description}</p>
          )}

          {canRsvp && (
            <>
              <h2 style={{ marginTop: 'var(--s-3)' }}>Your RSVP</h2>
              <div className="meeting-rsvp-row">
                {RSVP_OPTIONS.map(({ value, label, icon: Icon }) => {
                  const mine = myAttendance?.response === value;
                  return (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={mine ? 'primary' : 'secondary'}
                      onClick={() => rsvp(value)}
                      disabled={rsvpBusy}
                    >
                      <Icon size={11} aria-hidden="true" /> {label}
                    </Button>
                  );
                })}
              </div>
            </>
          )}

          <h2 style={{ marginTop: 'var(--s-3)' }}>
            <Users size={12} aria-hidden="true" /> Attendees · {meeting.attendees.length}
          </h2>
          <ul className="meeting-attendee-list">
            {meeting.attendees.map((a) => (
              <li key={a.userId} className="meeting-attendee-list-row">
                <Avatar src={a.avatarUrl} name={a.fullName || a.email} size="sm" />
                <div className="meeting-attendee-meta">
                  <div className="meeting-attendee-name truncate">{a.fullName}</div>
                  <div className="meeting-attendee-mail truncate">{a.email}</div>
                </div>
                {!a.required && <Badge tone="neutral">Optional</Badge>}
                <Badge tone={a.response === 'Accepted'
                  ? 'success'
                  : a.response === 'Declined'
                  ? 'danger'
                  : a.response === 'Tentative'
                  ? 'warning'
                  : 'neutral'}>
                  {a.response === 'Pending' ? 'No reply' : a.response}
                </Badge>
              </li>
            ))}
          </ul>
        </section>

        {isOrganiser && isLive && (
          <GuestLinksCard meetingId={meeting.id} toast={toast} />
        )}

        <TranscriptCard meetingId={meeting.id} toast={toast} />
      </div>
    </div>
  );
}

/**
 * F2-21 — post-meeting transcript surface on the detail page. Shows
 * the count + last-segment time + .txt / .vtt download buttons. The
 * live panel itself lives in the room — here we just expose the
 * artifact.
 */
function TranscriptCard({ meetingId, toast }) {
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const t = await meetingsApi.getTranscript(meetingId);
        if (!cancelled) setTranscript(t);
      } catch {
        if (!cancelled) setTranscript(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [meetingId]);

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

  const hasSegments = (transcript?.segments?.length ?? 0) > 0;

  return (
    <section className="meeting-detail-card" style={{ gridColumn: '1 / -1' }}>
      <div className="row between">
        <h2>Transcript</h2>
        {transcript?.lastSegmentAt && (
          <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
            Last segment {new Date(transcript.lastSegmentAt).toLocaleString([], {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
          </span>
        )}
      </div>
      {loading ? (
        <p className="muted">Loading transcript…</p>
      ) : hasSegments ? (
        <>
          <p className="muted">
            {transcript.segments.length} segments captured.
          </p>
          <div className="row gap-2">
            <Button size="sm" variant="ghost" onClick={() => download('txt')} disabled={downloading}>
              Download .txt
            </Button>
            <Button size="sm" variant="ghost" onClick={() => download('vtt')} disabled={downloading}>
              Download .vtt
            </Button>
          </div>
        </>
      ) : (
        <p className="muted">
          No transcript yet. Once participants enable captions in the room,
          segments appear here.
        </p>
      )}
    </section>
  );
}

/**
 * F2-20 — organiser surface to mint and revoke guest invite URLs.
 * Lives on the detail page so the workflow is "schedule → invite
 * externals" without a separate trip.
 */
function GuestLinksCard({ meetingId, toast }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await meetingsApi.listGuestLinks(meetingId);
      setLinks(rows);
    } catch {
      // Non-fatal — the card just shows empty.
    }
  }, [meetingId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  async function create() {
    setBusy(true);
    try {
      await meetingsApi.createGuestLink(meetingId, { guestLabel: label.trim() || null });
      setLabel('');
      await refresh();
      toast.show({ tone: 'success', message: 'Guest link created.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not create link.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function copy(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ tone: 'success', message: 'Link copied.' });
    } catch {
      toast.show({ tone: 'danger', message: 'Copy failed — select and copy manually.' });
    }
  }

  async function revoke(id) {
    if (!confirm('Revoke this guest link? Anyone holding it will be locked out.')) return;
    try {
      await meetingsApi.revokeGuestLink(id);
      await refresh();
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not revoke link.',
      });
    }
  }

  return (
    <section className="meeting-detail-card" style={{ gridColumn: '1 / -1' }}>
      <div className="row between">
        <h2><LinkIcon size={12} aria-hidden="true" /> Guest links</h2>
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
          Anyone with the link can join without an account.
        </span>
      </div>
      <div className="row gap-2" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input
            label="Optional label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Client review"
          />
        </div>
        <Button variant="primary" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'Create link'}
        </Button>
      </div>

      {loading ? (
        <p className="muted">Loading links…</p>
      ) : links.length === 0 ? (
        <p className="muted">No guest links yet.</p>
      ) : (
        <ul className="meeting-attendee-list">
          {links.map((g) => {
            const expired = new Date(g.expiresAt).getTime() < Date.now();
            const dead = !!g.revokedAt || expired;
            return (
              <li key={g.id} className="meeting-attendee-list-row">
                <div className="meeting-attendee-meta">
                  <div className="meeting-attendee-name truncate">
                    {g.guestLabel || 'Guest link'}
                  </div>
                  <div className="meeting-attendee-mail truncate" title={g.url}>
                    {g.url}
                  </div>
                </div>
                {g.revokedAt ? (
                  <Badge tone="danger">Revoked</Badge>
                ) : expired ? (
                  <Badge tone="warning">Expired</Badge>
                ) : (
                  <Badge tone="success">
                    Expires {new Date(g.expiresAt).toLocaleString([], {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </Badge>
                )}
                {!dead && (
                  <Button size="sm" variant="ghost" onClick={() => copy(g.url)} title="Copy link">
                    <Copy size={11} aria-hidden="true" />
                  </Button>
                )}
                {!g.revokedAt && (
                  <Button size="sm" variant="ghost" onClick={() => revoke(g.id)}>
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * F2-22 — organiser action to mark a meeting Completed and run the
 * post-meeting AI pass. Decoupled so the toast / busy state stays
 * out of the detail page's main render path.
 */
function FinaliseButton({ meetingId, onFinalised }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!confirm('Finalise this meeting? Captions stop and the AI generates a summary.')) return;
    setBusy(true);
    try {
      await meetingsApi.finalise(meetingId);
      toast.show({ tone: 'success', message: 'Meeting finalised — opening the summary.' });
      await onFinalised?.();
    } catch (err) {
      const status = err.response?.status;
      const msg = status === 503
        ? 'AI is not configured on the server.'
        : status === 422
        ? 'No transcript yet — captions need to run first.'
        : err.response?.data?.detail ?? 'Could not finalise.';
      toast.show({ tone: 'danger', message: msg });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="primary" onClick={run} disabled={busy}>
      <CheckCircle2 size={12} aria-hidden="true" />
      {busy ? ' Finalising…' : ' Finalise & summarise'}
    </Button>
  );
}
