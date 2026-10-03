import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, Sparkles, X } from 'lucide-react';
import {
  Avatar,
  Button,
  Input,
  Select,
  Skeleton,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { meetingsApi } from '@/api/meetings.api';
import { useAuthStore } from '@/store/authStore';
import { RecurrencePicker } from '@/components/meetings/RecurrencePicker';
import '@/components/meetings/meetings.css';

const TYPES = [
  { value: 'Standup', label: 'Standup' },
  { value: 'Planning', label: 'Sprint planning' },
  { value: 'Review', label: 'Sprint review' },
  { value: 'Retrospective', label: 'Retrospective' },
  { value: 'OneOnOne', label: '1:1' },
  { value: 'Other', label: 'Other' },
];

const DURATIONS = [15, 30, 45, 60, 90];

function defaultScheduledLocal() {
  // Default to "next round half-hour" so the form lands on a sensible slot.
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return toLocalInputValue(d);
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * F2-19 — schedule a meeting against a project. Title, time, duration,
 * type, attendees and an optional AI-drafted agenda. Submitting creates
 * the meeting, fires the .ics invite emails, and routes back to the
 * meetings list.
 */
export function CreateMeetingPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const me = useAuthStore((s) => s.user);

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Standup');
  const [scheduledLocal, setScheduledLocal] = useState(defaultScheduledLocal());
  const [duration, setDuration] = useState(30);
  const [recurrence, setRecurrence] = useState('');
  const [agendaMd, setAgendaMd] = useState('');
  const [agendaFromAi, setAgendaFromAi] = useState(false);
  const [picked, setPicked] = useState([]); // attendee user ids
  const [requiredMap, setRequiredMap] = useState({}); // userId -> required?
  const [generatingAgenda, setGeneratingAgenda] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        const ms = await projectsApi.listMembers(p.id);
        if (cancelled) return;
        setMembers(ms);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug]);

  function togglePick(userId) {
    setPicked((cur) =>
      cur.includes(userId) ? cur.filter((id) => id !== userId) : [...cur, userId]);
  }
  function toggleRequired(userId) {
    setRequiredMap((cur) => ({ ...cur, [userId]: !(cur[userId] ?? true) }));
  }

  async function generateAgenda() {
    if (!project) return;
    if (!title.trim()) {
      toast.show({ tone: 'danger', message: 'Add a meeting title first.' });
      return;
    }
    setGeneratingAgenda(true);
    try {
      const res = await meetingsApi.previewAgenda(project.id, {
        title,
        type,
        durationMinutes: duration,
        attendeeUserIds: picked,
        organiserNotes: description || null,
      });
      setAgendaMd(res.body);
      setAgendaFromAi(true);
      toast.show({ tone: 'success', message: 'Draft agenda ready. Edit before saving.' });
    } catch (err) {
      const status = err.response?.status;
      const msg = status === 503
        ? 'AI is not configured on the server.'
        : err.response?.data?.detail ?? 'Could not draft agenda.';
      toast.show({ tone: 'danger', message: msg });
    } finally {
      setGeneratingAgenda(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!project) return;
    if (picked.length === 0) {
      toast.show({ tone: 'danger', message: 'Add at least one attendee.' });
      return;
    }
    setBusy(true);
    try {
      const attendees = picked.map((userId) => ({
        userId,
        required: requiredMap[userId] ?? true,
      }));
      const meeting = await meetingsApi.create(project.id, {
        title: title.trim(),
        description: description.trim() || null,
        type,
        scheduledAt: new Date(scheduledLocal).toISOString(),
        durationMinutes: duration,
        recurrenceRule: recurrence || null,
        agendaMd: agendaMd.trim() || null,
        agendaFromAi: agendaFromAi && !!agendaMd.trim(),
        attendees,
      });
      toast.show({ tone: 'success', message: 'Meeting scheduled. Invites sent.' });
      navigate(`/${orgSlug}/projects/${projectSlug}/meetings/${meeting.id}`);
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Could not schedule meeting.';
      toast.show({ tone: 'danger', message: msg });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="main-inner"><Skeleton height={400} radius="lg" /></div>;
  }
  if (!project) {
    return <div className="main-inner"><p className="muted">Project not found.</p></div>;
  }

  return (
    <div className="main-inner">
      <header className="page-head">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">{project.name} · Meetings</p>
            <h1 className="page-title">Schedule a meeting</h1>
            <p className="page-subtitle">
              Invites go out by email with an .ics attachment. Recurring meetings stay one series.
            </p>
          </div>
        </div>
      </header>

      <form className="mtg-form" onSubmit={submit}>
        <div className="mtg-form-grid">
          <section className="card mtg-section">
            <h2 className="mtg-section-title">Basics</h2>
            <Input
              label="Title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly status check"
              required
              maxLength={200}
            />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — appears in the calendar invite body"
            />
            <Select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={TYPES}
            />
            <div className="mtg-form-row">
              <Input
                type="datetime-local"
                label="When"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                required
              />
              <Select
                label="Duration"
                value={String(duration)}
                onChange={(e) => setDuration(Number(e.target.value))}
                options={DURATIONS.map((d) => ({ value: String(d), label: `${d} min` }))}
              />
            </div>
            <RecurrencePicker
              value={recurrence}
              onChange={setRecurrence}
              scheduledAt={scheduledLocal}
            />
          </section>

          <section className="card mtg-section">
            <div>
              <h2 className="mtg-section-title">Attendees</h2>
              <p className="mtg-section-sub">
                You're added automatically as organiser{picked.length > 0 ? ` · ${picked.length} invited` : ''}.
              </p>
            </div>
            <div className="mtg-people">
              {members
                .filter((m) => m.userId !== me?.id)
                .map((m) => {
                  const isPicked = picked.includes(m.userId);
                  const required = requiredMap[m.userId] ?? true;
                  return (
                    <div
                      key={m.userId}
                      className={['mtg-person', isPicked && 'is-picked']
                        .filter(Boolean).join(' ')}
                    >
                      <Avatar src={m.avatarUrl} name={m.fullName || m.email} size="md" />
                      <div className="mtg-person-meta">
                        <div className="mtg-person-name truncate">{m.fullName}</div>
                        <div className="mtg-person-mail truncate">{m.email}</div>
                      </div>
                      {isPicked && (
                        <label className="mtg-required">
                          <input
                            type="checkbox"
                            className="cb"
                            checked={required}
                            onChange={() => toggleRequired(m.userId)}
                          /> Required
                        </label>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant={isPicked ? 'ghost' : 'secondary'}
                        onClick={() => togglePick(m.userId)}
                      >
                        {isPicked ? 'Remove' : 'Invite'}
                      </Button>
                    </div>
                  );
                })}
              {members.length <= 1 && (
                <p className="mtg-note">
                  Add members to this project first.
                </p>
              )}
            </div>
          </section>

          <section className="card mtg-section mtg-span">
            <div className="mtg-section-head">
              <h2 className="mtg-section-title">Agenda</h2>
              <div className="row gap-2">
                {agendaMd && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setAgendaMd(''); setAgendaFromAi(false); }}
                  >
                    <X size={13} aria-hidden="true" /> Clear
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ai"
                  onClick={generateAgenda}
                  disabled={generatingAgenda}
                >
                  <Sparkles size={13} aria-hidden="true" />
                  {generatingAgenda ? 'Drafting…' : 'AI draft'}
                </Button>
              </div>
            </div>
            <textarea
              className="mtg-textarea"
              value={agendaMd}
              onChange={(e) => {
                setAgendaMd(e.target.value);
                if (agendaFromAi) setAgendaFromAi(false);
              }}
              placeholder="- Topic 1 (~5 min)&#10;- Topic 2 (~10 min)&#10;- Open questions"
            />
            <p className="mtg-note">
              {agendaFromAi
                ? 'AI-drafted agenda. Edit freely — the "AI draft" flag is dropped on any change.'
                : 'Optional. Markdown is supported. You can keep editing up until the meeting starts.'}
            </p>
          </section>
        </div>

        <footer className="mtg-form-foot">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/${orgSlug}/projects/${projectSlug}/meetings`)}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            <Calendar size={14} aria-hidden="true" />
            {busy ? 'Scheduling…' : 'Schedule meeting'}
          </Button>
        </footer>
      </form>
    </div>
  );
}
