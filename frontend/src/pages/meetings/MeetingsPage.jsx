import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, CalendarPlus, Repeat, Zap } from 'lucide-react';
import {
  Button,
  Segmented,
  Skeleton,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { meetingsApi } from '@/api/meetings.api';
import { useAuthStore } from '@/store/authStore';
import { describeRecurrence } from '@/components/meetings/recurrence';
import { InstantMeetingModal } from '@/components/meetings/InstantMeetingModal';
import { useNow } from '@/hooks/useNow';
import '@/components/meetings/meetings.css';

const TYPE_LABELS = {
  Standup: 'Standup',
  Planning: 'Planning',
  Review: 'Review',
  Retrospective: 'Retrospective',
  OneOnOne: '1:1',
  Other: 'Meeting',
};

// Status read-outs are dot + coloured text (see .mtg-dot in meetings.css).
const STATUS_LABELS = {
  InProgress: 'Live now',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
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
  const now = useNow();

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
    return scope === 'upcoming'
      ? meetings.filter((m) => new Date(m.scheduledAt).getTime() > now - 60 * 60 * 1000)
      : meetings;
  }, [scope, meetings, now]);

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
              Invitees get an .ics in their inbox; recurring meetings stay one series.
            </p>
          </div>
          <div className="row gap-2">
            <Button
              variant="secondary"
              onClick={() => setInstantOpen(true)}
            >
              <Zap size={14} aria-hidden="true" /> Start instant meeting
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate(`/${orgSlug}/projects/${projectSlug}/meetings/new`)}
            >
              <CalendarPlus size={14} aria-hidden="true" /> New meeting
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
        <div className="card">
          <div className="empty">
            <span className="empty-icon"><CalendarDays size={22} aria-hidden="true" /></span>
            <p className="empty-title">No meetings to show</p>
            <p className="empty-desc">
              {scope === 'upcoming'
                ? 'Nothing on the calendar yet. Schedule one, or start an instant meeting.'
                : 'Try another view to see more meetings.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card mtg-list">
          {upcomingByScope.map((m) => {
            const start = new Date(m.scheduledAt);
            const isPast = start.getTime() + m.durationMinutes * 60_000 < now;
            const recurrenceLabel = describeRecurrence(m.recurrenceRule);
            const statusLabel = STATUS_LABELS[m.status];
            return (
              <Link
                key={m.id}
                to={`/${orgSlug}/projects/${projectSlug}/meetings/${m.id}`}
                className={[
                  'mtg-row',
                  isPast && 'is-past',
                  m.status === 'Cancelled' && 'is-cancelled',
                ].filter(Boolean).join(' ')}
              >
                <div className="mtg-date" aria-hidden="true">
                  <span className="mtg-date-month">{start.toLocaleDateString([], { month: 'short' })}</span>
                  <span className="mtg-date-day">{start.getDate()}</span>
                </div>
                <div className="mtg-row-main">
                  <h2 className="mtg-row-title truncate">{m.title}</h2>
                  <p className="mtg-row-meta">
                    <span>
                      {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span>{m.durationMinutes} min</span>
                    <span>{TYPE_LABELS[m.type] ?? m.type}</span>
                    <span>Organised by {m.organizerFullName}</span>
                    {m.isRecurring && (
                      <span className="mtg-row-repeat">
                        <Repeat size={12} aria-hidden="true" /> {recurrenceLabel ?? 'Repeats'}
                      </span>
                    )}
                  </p>
                </div>
                <div className="mtg-row-aside">
                  {statusLabel && (
                    <span className={`mtg-dot mtg-dot-${m.status.toLowerCase()}`}>{statusLabel}</span>
                  )}
                  {m.myResponse && (
                    <span className={`mtg-dot mtg-dot-rsvp-${m.myResponse.toLowerCase()}`}>
                      {RSVP_LABELS[m.myResponse] ?? m.myResponse}
                    </span>
                  )}
                  <span className="mtg-row-count" title="Accepted / invited">
                    <strong>{m.acceptedCount}</strong>/{m.attendeeCount} going
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
