import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Copy,
  Download,
  MoreHorizontal,
  Repeat,
  Sparkles,
  Trash2,
  Video,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Dropdown,
  Input,
  Segmented,
  Skeleton,
  useToast,
} from '@/components/ui';
import { meetingsApi } from '@/api/meetings.api';
import { useAuthStore } from '@/store/authStore';
import { describeRecurrence } from '@/components/meetings/recurrence';
import '@/components/meetings/meetings.css';

const TYPE_LABELS = {
  Standup: 'Standup',
  Planning: 'Planning',
  Review: 'Review',
  Retrospective: 'Retrospective',
  OneOnOne: '1:1',
  Other: 'Meeting',
};

const RSVP_OPTIONS = [
  { value: 'Accepted', label: 'Accept' },
  { value: 'Tentative', label: 'Maybe' },
  { value: 'Declined', label: 'Decline' },
];

const RESPONSE_LABELS = {
  Accepted: 'Accepted',
  Declined: 'Declined',
  Tentative: 'Tentative',
  Pending: 'No reply',
};

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

  const acceptedCount = meeting.attendees.filter((a) => a.response === 'Accepted').length;

  return (
    <div className="main-inner">
      <header className="page-head">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">{meeting.projectName} · Meetings</p>
            <h1 className="page-title">{meeting.title}</h1>
            <p className="mtg-head-meta">
              <span>{TYPE_LABELS[meeting.type] ?? meeting.type}</span>
              {meeting.status === 'InProgress' ? (
                <span className="mtg-dot mtg-dot-inprogress">Live now</span>
              ) : meeting.status !== 'Scheduled' && (
                <span className={`mtg-dot mtg-dot-${meeting.status.toLowerCase()}`}>
                  {meeting.status}
                </span>
              )}
              {recurrenceLabel && (
                <span className="mtg-row-repeat">
                  <Repeat size={13} aria-hidden="true" /> {recurrenceLabel}
                </span>
              )}
            </p>
          </div>
          <div className="row gap-3">
            {isOrganiser && isLive && (
              <FinaliseButton
                meetingId={meeting.id}
                onFinalised={async () => {
                  await refresh();
                  navigate(`/${orgSlug}/projects/${projectSlug}/meetings/${meeting.id}/summary`);
                }}
              />
            )}
            {isLive && (
              <Button
                variant="primary"
                onClick={() =>
                  navigate(`/${orgSlug}/projects/${projectSlug}/meetings/${meeting.id}/room`)
                }
              >
                <Video size={14} aria-hidden="true" />
                {meeting.status === 'InProgress' ? ' Rejoin meeting' : ' Join meeting'}
              </Button>
            )}
            {meeting.status === 'Completed' && (
              <Button
                variant="primary"
                onClick={() =>
                  navigate(`/${orgSlug}/projects/${projectSlug}/meetings/${meeting.id}/summary`)
                }
              >
                <Sparkles size={14} aria-hidden="true" /> View summary
              </Button>
            )}
            {isOrganiser && isLive && (
              <Dropdown
                align="end"
                trigger={(
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="More meeting actions"
                    title="More actions"
                  >
                    <MoreHorizontal size={18} aria-hidden="true" />
                  </button>
                )}
              >
                <Dropdown.Item
                  danger
                  onSelect={cancelMeeting}
                  icon={<Trash2 size={13} aria-hidden="true" />}
                >
                  Cancel meeting
                </Dropdown.Item>
              </Dropdown>
            )}
          </div>
        </div>
      </header>

      <div className="mtg-detail">
        <div className="mtg-detail-main">
          <section className="card mtg-section">
            <div className="mtg-section-head">
              <h2 className="mtg-section-title">Agenda</h2>
              {canEditAgenda && !editingAgenda && (
                <Button size="sm" variant="ghost" onClick={() => setEditingAgenda(true)}>
                  Edit
                </Button>
              )}
            </div>
            {editingAgenda ? (
              <>
                <textarea
                  className="mtg-textarea"
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
              <pre className="mtg-agenda">{meeting.agendaMd}</pre>
            ) : (
              <p className="mtg-empty">No agenda yet.</p>
            )}
            {meeting.agendaFromAi && meeting.agendaMd && (
              <p className="mtg-note">Drafted by AI.</p>
            )}
          </section>

          <TranscriptCard meetingId={meeting.id} toast={toast} />

          {isOrganiser && isLive && (
            <GuestLinksCard meetingId={meeting.id} toast={toast} />
          )}
        </div>

        <div className="mtg-detail-side">
          <section className="card mtg-section">
            <p className="mtg-when-label">When</p>
            <div>
              <p className="mtg-when">
                {start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="mtg-when-time">
                {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {' – '}
                {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {' · '}
                {meeting.durationMinutes} min
              </p>
            </div>
            {meeting.description && (
              <p className="mtg-desc">{meeting.description}</p>
            )}

            {canRsvp && (
              <div className="mtg-rsvp">
                <p className="mtg-when-label">Your RSVP</p>
                <Segmented
                  ariaLabel="Your RSVP"
                  value={myAttendance?.response}
                  onChange={rsvp}
                  options={RSVP_OPTIONS.map((o) => ({ ...o, disabled: rsvpBusy }))}
                />
              </div>
            )}
          </section>

          <section className="card mtg-section">
            <div className="mtg-section-head">
              <h2 className="mtg-section-title">Attendees</h2>
              <span className="mtg-section-count">
                {acceptedCount} of {meeting.attendees.length} accepted
              </span>
            </div>
            <ul className="mtg-people">
              {meeting.attendees.map((a) => (
                <li key={a.userId} className="mtg-person">
                  <Avatar src={a.avatarUrl} name={a.fullName || a.email} size="md" />
                  <div className="mtg-person-meta">
                    <div className="mtg-person-name truncate">
                      {a.fullName}
                      {!a.required && <span className="mtg-person-optional"> · Optional</span>}
                    </div>
                    <div className="mtg-person-mail truncate">{a.email}</div>
                  </div>
                  <span className={`mtg-dot mtg-dot-rsvp-${(a.response ?? 'Pending').toLowerCase()}`}>
                    {RESPONSE_LABELS[a.response] ?? a.response}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
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
    <section className="card mtg-section">
      <div className="mtg-section-head">
        <h2 className="mtg-section-title">Transcript</h2>
        {transcript?.lastSegmentAt && (
          <span className="mtg-section-count">
            Last segment {new Date(transcript.lastSegmentAt).toLocaleString([], {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
          </span>
        )}
      </div>
      {loading ? (
        <p className="mtg-empty">Loading transcript…</p>
      ) : hasSegments ? (
        <div className="mtg-transcript-row">
          <p className="mtg-transcript-stat">
            <strong>{transcript.segments.length}</strong> segments captured
          </p>
          <div className="row gap-2">
            <Button size="sm" variant="ghost" onClick={() => download('txt')} disabled={downloading}>
              <Download size={13} aria-hidden="true" /> Download .txt
            </Button>
            <Button size="sm" variant="ghost" onClick={() => download('vtt')} disabled={downloading}>
              <Download size={13} aria-hidden="true" /> Download .vtt
            </Button>
          </div>
        </div>
      ) : (
        <p className="mtg-empty">
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
    <section className="card mtg-section">
      <div>
        <h2 className="mtg-section-title">Guest links</h2>
        <p className="mtg-section-sub">Anyone with the link can join without an account.</p>
      </div>
      <div className="mtg-guest-create">
        <div className="mtg-guest-input">
          <Input
            label="Optional label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Client review"
          />
        </div>
        <Button variant="secondary" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'Create link'}
        </Button>
      </div>

      {loading ? (
        <p className="mtg-empty">Loading links…</p>
      ) : links.length === 0 ? (
        <p className="mtg-empty">No guest links yet.</p>
      ) : (
        <ul className="mtg-people">
          {links.map((g) => {
            const expired = new Date(g.expiresAt).getTime() < Date.now();
            const dead = !!g.revokedAt || expired;
            return (
              <li key={g.id} className="mtg-person">
                <div className="mtg-person-meta">
                  <div className="mtg-person-name truncate">
                    {g.guestLabel || 'Guest link'}
                  </div>
                  <div className="mtg-person-mail truncate" title={g.url}>
                    {g.url}
                  </div>
                </div>
                {g.revokedAt ? (
                  <span className="mtg-dot mtg-dot-cancelled">Revoked</span>
                ) : expired ? (
                  <span className="mtg-dot mtg-dot-rsvp-tentative">Expired</span>
                ) : (
                  <span className="mtg-dot mtg-dot-rsvp-accepted">
                    Expires {new Date(g.expiresAt).toLocaleString([], {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                )}
                <div className="mtg-guest-actions">
                  {!dead && (
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      onClick={() => copy(g.url)}
                      title="Copy link"
                      aria-label="Copy link"
                    >
                      <Copy size={14} aria-hidden="true" />
                    </button>
                  )}
                  {!g.revokedAt && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(g.id)}>
                      Revoke
                    </Button>
                  )}
                </div>
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
    <Button variant="secondary" onClick={run} disabled={busy}>
      <CheckCircle2 size={14} aria-hidden="true" />
      {busy ? ' Finalising…' : ' Finalise & summarise'}
    </Button>
  );
}
