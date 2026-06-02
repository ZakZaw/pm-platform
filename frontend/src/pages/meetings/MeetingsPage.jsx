import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, Repeat, Users, Zap } from 'lucide-react';
import {
  Badge,
  Button,
  Segmented,
  Skeleton,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { meetingsApi } from '@/api/meetings.api';
import { useAuthStore } from '@/store/authStore';
import { describeRecurrence } from '@/components/meetings/recurrence';
import { InstantMeetingModal } from '@/components/meetings/InstantMeetingModal';
import '@/components/meetings/meetings.css';

const TYPE_TONES = {
  Standup: 'info',
  Planning: 'purple',
  Review: 'success',
  Retrospective: 'warning',
  OneOnOne: 'neutral',
  Other: 'neutral',
};

const STATUS_TONES = {
  Scheduled: 'info',
  InProgress: 'warning',
  Completed: 'success',
  Cancelled: 'danger',
};

const RSVP_LABELS = {
  Accepted: 'Going',
  Declined: 'Not going',
  Tentative: 'Tentative',
  Pending: 'No reply',
};

/**
 * F2-19 — meetings tab on a project. Lists upcoming meetings by
 * default, with a toggle for the past. Cancelled meetings are hidden
 * unless the user explicitly asks.
 */
export function MeetingsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [scope, setScope] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [instantOpen, setInstantOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        projectsApi.listMembers(p.id).then((ms) => { if (!cancelled) setMembers(ms); });
        const list = await meetingsApi.listForProject(p.id, {
          includePast: scope === 'past' || scope === 'all',
          includeCancelled: scope === 'all',
        });
        if (cancelled) return;
        // Past view should show most-recent-first; upcoming keeps the
        // soonest at the top.
        const sorted = scope === 'past'
          ? [...list].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
          : list;
        setMeetings(sorted);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, scope]);

  const upcomingByScope = useMemo(() => {
    const now = Date.now();
    return scope === 'upcoming'
      ? meetings.filter((m) => new Date(m.scheduledAt).getTime() > now - 60 * 60 * 1000)
      : meetings;
  }, [scope, meetings]);
  const renderedNow = useMemo(() => Date.now(), [meetings]);

  if (loading && !project) {
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
            <p className="eyebrow">{project.name}</p>
            <h1 className="page-title">Meetings</h1>
            <p className="page-subtitle">
              Schedule a meeting and invitees get an .ics in their inbox.
              Recurring meetings live as a single series.
            </p>
          </div>
          <div className="row gap-2">
            <Button
              variant="secondary"
              onClick={() => setInstantOpen(true)}
            >
              <Zap size={12} aria-hidden="true" /> Start instant meeting
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate(`/${orgSlug}/projects/${projectSlug}/meetings/new`)}
            >
              <CalendarPlus size={12} aria-hidden="true" /> New meeting
            </Button>
          </div>
        </div>
      </header>

      {instantOpen && (
        <InstantMeetingModal
          project={project}
          members={members}
          meId={me?.id}
          onClose={() => setInstantOpen(false)}
          onStarted={(meeting) =>
            navigate(`/${orgSlug}/projects/${projectSlug}/meetings/${meeting.id}/room`)
          }
        />
      )}

      <div className="meetings-toolbar">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {upcomingByScope.length === 0 ? (
        <p className="muted">No meetings to show.</p>
      ) : (
        <div className="meetings-list">
          {upcomingByScope.map((m) => {
            const start = new Date(m.scheduledAt);
            const isPast = start.getTime() + m.durationMinutes * 60_000 < renderedNow;
            const recurrenceLabel = describeRecurrence(m.recurrenceRule);
            return (
              <Link
                key={m.id}
                to={`/${orgSlug}/projects/${projectSlug}/meetings/${m.id}`}
                className={[
                  'meeting-card',
                  isPast && 'is-past',
                  m.status === 'Cancelled' && 'is-cancelled',
                ].filter(Boolean).join(' ')}
              >
                <div className="meeting-card-when">
                  <span className="meeting-card-day">{start.toLocaleDateString([], { month: 'short' })}</span>
                  <span className="meeting-card-date">{start.getDate()}</span>
                  <span className="meeting-card-time">
                    {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <div className="meeting-card-main">
                  <h2 className="meeting-card-title">{m.title}</h2>
                  <div className="meeting-card-meta">
                    <Badge tone={TYPE_TONES[m.type] ?? 'neutral'}>{m.type}</Badge>
                    {m.status !== 'Scheduled' && (
                      <Badge tone={STATUS_TONES[m.status] ?? 'neutral'}>{m.status}</Badge>
                    )}
                    <span>· {m.durationMinutes} min</span>
                    <span>· Organised by {m.organizerFullName}</span>
                    {m.isRecurring && (
                      <span>
                        · <Repeat size={11} aria-hidden="true" /> {recurrenceLabel ?? 'Repeats'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="meeting-card-aside">
                  <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    <Users size={11} aria-hidden="true" /> {m.acceptedCount}/{m.attendeeCount}
                  </span>
                  {m.myResponse && (
                    <Badge tone={m.myResponse === 'Accepted' ? 'success' : 'neutral'}>
                      {RSVP_LABELS[m.myResponse] ?? m.myResponse}
                    </Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
