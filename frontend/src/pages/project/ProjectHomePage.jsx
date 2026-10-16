import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Briefcase,
  Check,
  MessageSquare,
  Plus,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  AvatarStack,
  Badge,
  Button,
  Skeleton,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { epicsApi } from '@/api/epics.api';
import { sprintsApi } from '@/api/sprints.api';
import { analyticsApi } from '@/api/analytics.api';
import { activityApi } from '@/api/activity.api';
import { findProjectType } from '@/constants/projectTypes';
import { deltaClass } from '@/utils/formatMetrics';
import { describeActivity, relativeTime } from '@/utils/activityFormat';
import './ProjectHomePage.css';

const ACTIVITY_LIMIT = 6;

const TYPE_VOCAB = {
  Engineering: { hierarchy: 'Epic → Task', item: 'Task' },
  Sales: { hierarchy: 'Account → Deal', item: 'Deal' },
  Support: { hierarchy: 'Customer → Ticket', item: 'Ticket' },
  Marketing: { hierarchy: 'Campaign → Asset', item: 'Asset' },
  Operations: { hierarchy: 'Runbook → Run', item: 'Run' },
  Generic: { hierarchy: 'List → Task', item: 'Task' },
};

// Project AI control mode → short label for the header read-out.
const AI_MODE_LABEL = {
  Off: 'Off',
  AskMeFirst: 'Ask me first',
  Suggest: 'Suggest',
  Autopilot: 'Autopilot',
};

const PRIMARY_ACTION_PATH = {
  Engineering: 'backlog',
  Sales: 'pipeline',
  Support: 'queues',
  Marketing: 'campaigns',
  Operations: 'runbooks',
  Generic: 'lists',
};

function dateParts(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    d: String(d.getDate()).padStart(2, '0'),
    m: d.toLocaleString(undefined, { month: 'short' }),
  };
}

// Activity verb → row icon.
function activityIcon(verb) {
  if (verb === 'CommentAdded') return <MessageSquare size={14} />;
  if (verb?.startsWith('Task')) return <Check size={14} />;
  return <Activity size={14} />;
}

// Arrow for a server-formatted delta ("+3", "-8%", "±0").
function DeltaArrow({ delta }) {
  if (!delta || delta.startsWith('±')) return null;
  return delta.startsWith('-') || delta.startsWith('−')
    ? <ArrowDown size={10} strokeWidth={3} />
    : <ArrowUp size={10} strokeWidth={3} />;
}

export function ProjectHomePage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [epics, setEpics] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [members, setMembers] = useState([]);
  // Server-composed KPI tiles + health card (one call), and the activity feed.
  const [home, setHome] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        const [es, sprint, ms, homeData, feed] = await Promise.all([
          epicsApi.listForProject(p.id),
          sprintsApi.getActive(p.id).catch(() => null),
          projectsApi.listMembers(p.id).catch(() => []),
          analyticsApi.home(p.id).catch(() => null),
          activityApi.listForProject(p.id, { limit: ACTIVITY_LIMIT }).catch(() => null),
        ]);
        if (cancelled) return;
        setEpics(es);
        setActiveSprint(sprint ?? null);
        setMembers(ms);
        setHome(homeData);
        setActivity(feed?.entries ?? []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load project.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, projectSlug]);

  const meta = project ? findProjectType(project.type) : null;
  const typeId = meta?.id ?? 'Engineering';
  const vocab = TYPE_VOCAB[typeId] ?? TYPE_VOCAB.Engineering;
  const iconClass = `proj-icon proj-icon-${typeId.toLowerCase()}`;

  const kpis = home?.kpis ?? [];
  const health = home?.health ?? null;

  const upcoming = useMemo(() => {
    if (!project) return [];
    const out = [];
    if (activeSprint?.endDate) {
      const dp = dateParts(activeSprint.endDate);
      if (dp) out.push({ ...dp, t: `${activeSprint.name} ends`, key: `sprint-${activeSprint.id}` });
    }
    for (const e of epics) {
      if (!e.targetDate) continue;
      const dp = dateParts(e.targetDate);
      if (dp) out.push({ ...dp, t: `${e.title} target`, key: `epic-${e.id}` });
    }
    return out.slice(0, 4);
  }, [project, activeSprint, epics]);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!project) {
    return (
      <div className="main-inner" aria-busy="true">
        <div className="page-head project-home-skeleton-head">
          <Skeleton width="40%" height={28} />
          <Skeleton width="60%" height={14} />
        </div>
        <div className="grid-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={92} radius="lg" />
          ))}
        </div>
        <div className="grid-12 project-home-body">
          <div className="col-8"><Skeleton height={320} radius="lg" /></div>
          <div className="col-4"><Skeleton height={320} radius="lg" /></div>
        </div>
      </div>
    );
  }

  const primaryPath = PRIMARY_ACTION_PATH[typeId] ?? 'backlog';
  const leadMember = members[0];
  const aiMode = AI_MODE_LABEL[project.aiControlMode] ?? 'Suggest';

  return (
    <div className="main-inner project-home">
      <div className="page-head">
        <div className="page-title-row">
          <div className="row gap-5">
            <div className={`${iconClass} project-home-icon`}>
              {meta?.short?.[0] ?? <Briefcase size={22} />}
            </div>
            <div>
              <div className="eyebrow">{meta?.label} project · {vocab.hierarchy}</div>
              <h1 className="page-title">{project.name}</h1>
              <p className="page-subtitle">
                {leadMember ? `Led by ${leadMember.fullName} · ` : ''}
                {members.length} member{members.length === 1 ? '' : 's'}
                {' · '}
                <Link className="project-home-ai-mode" to={`/${orgSlug}/projects/${projectSlug}/ai`}>
                  AI: {aiMode}
                </Link>
              </p>
            </div>
          </div>
          <div className="row gap-3">
            <AvatarStack people={members} max={5} size="sm" />
            <Link to={`/${orgSlug}/projects/${projectSlug}/ai`}>
              <Button variant="secondary" size="sm">
                <Sparkles size={13} aria-hidden="true" /> Ask AI
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/${orgSlug}/projects/${projectSlug}/${primaryPath}`)}
            >
              <Plus size={14} aria-hidden="true" /> New {vocab.item.toLowerCase()}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid-4">
        {home === null
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={92} radius="lg" />)
          : kpis.map((k) => (
            <div key={k.label} className="stat">
              <div className="stat-label">{k.label}</div>
              <div className="stat-value">{k.value}</div>
              {(k.sub || k.delta) && (
                <div className="stat-row project-home-stat-sub">
                  {k.sub && <span>{k.sub}</span>}
                  {k.delta && (
                    <span className={`stat-delta ${deltaClass(k.deltaGood)}`}>
                      <DeltaArrow delta={k.delta} />
                      {k.delta}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>

      <div className="grid-12 project-home-body">
        <div className="col-8 col">
          <div className="card">
            <div className="card-header">
              <h3 className="h-card">Activity</h3>
            </div>
            <div className="card-body project-home-activity">
              {activity === null && <Skeleton rows={4} />}
              {activity?.length === 0 && (
                <p className="muted project-home-empty">No activity in this project yet.</p>
              )}
              {activity?.map((entry) => (
                <div key={entry.id} className="project-home-activity-row">
                  <div className="project-home-activity-icon">{activityIcon(entry.verb)}</div>
                  <div className="project-home-activity-main">
                    <div className="project-home-activity-head">
                      <strong>{entry.actor?.fullName ?? 'Someone'}</strong>
                      <span
                        className="muted project-home-activity-time"
                        title={new Date(entry.createdAt).toLocaleString()}
                      >
                        {relativeTime(entry.createdAt)}
                      </span>
                    </div>
                    <div className="muted project-home-activity-body">{describeActivity(entry)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-4 col project-home-side">
          <div className="ai-card">
            <div className="ai-card-head">
              <div className="ai-mark"><Sparkles size={14} /></div>
              <h3 className="h-card">{health?.title ?? 'Project health'}</h3>
            </div>
            <div className="ai-card-body">
              {health ? (
                <>
                  <p className="project-home-ai-headline">{health.headline}</p>
                  <p className="project-home-ai-copy">{health.detail}</p>
                  {health.highlights?.length > 0 && (
                    <div className="row gap-2 project-home-ai-chips">
                      {health.highlights.map((h) => <Badge key={h} tone="neutral">{h}</Badge>)}
                    </div>
                  )}
                </>
              ) : home === null ? (
                <Skeleton rows={2} />
              ) : (
                <p className="project-home-ai-copy">Health signals are unavailable right now.</p>
              )}
              <div className="row gap-3">
                <Link to={`/${orgSlug}/projects/${projectSlug}/ai`}>
                  <Button variant="secondary" size="sm">
                    <Wand2 size={13} aria-hidden="true" /> Open suggestions
                  </Button>
                </Link>
                <Link to={`/${orgSlug}/projects/${projectSlug}/ai`}>
                  <Button variant="ghost" size="sm">Ask anything</Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="h-card">Upcoming</h3></div>
            <div className="card-body project-home-upcoming">
              {upcoming.length === 0 ? (
                <p className="muted project-home-empty">No upcoming dates.</p>
              ) : (
                upcoming.map((e) => (
                  <div key={e.key} className="project-home-upcoming-row">
                    <div className="project-home-upcoming-date">
                      <div className="project-home-upcoming-month">{e.m}</div>
                      <div className="project-home-upcoming-day">{e.d}</div>
                    </div>
                    <div className="project-home-upcoming-title">{e.t}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
