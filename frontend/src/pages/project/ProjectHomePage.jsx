import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Check,
  GitPullRequest,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  AIChip,
  AvatarStack,
  Badge,
  Button,
  Card,
  Chip,
  Skeleton,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { epicsApi } from '@/api/epics.api';
import { tasksApi } from '@/api/tasks.api';
import { sprintsApi } from '@/api/sprints.api';
import { findProjectType } from '@/constants/projectTypes';
import './ProjectHomePage.css';

const TYPE_VOCAB = {
  Engineering: { hierarchy: 'Epic → Task', item: 'Task' },
  Sales: { hierarchy: 'Account → Deal', item: 'Deal' },
  Support: { hierarchy: 'Customer → Ticket', item: 'Ticket' },
  Marketing: { hierarchy: 'Campaign → Asset', item: 'Asset' },
  Operations: { hierarchy: 'Runbook → Run', item: 'Run' },
  Generic: { hierarchy: 'List → Task', item: 'Task' },
};

const TYPE_BADGE_TONE = {
  Engineering: 'accent',
  Sales: 'success',
  Support: 'rose',
  Marketing: 'warning',
  Operations: 'violet',
  Generic: 'neutral',
};

const SPRINT_HEALTH_COPY = {
  Engineering: 'Velocity is 22% below trailing avg. Two tasks likely to slip.',
  Sales: 'Pipeline coverage is 2.4× target. Two large deals stalled in Proposal.',
  Support: '4 tickets approaching SLA breach. 1 recurring issue detected.',
  Marketing: 'Calendar is balanced. Next launch needs a final asset by Mon.',
  Operations: 'All scheduled runs on track. Next compliance check in 9d.',
  Generic: 'List is balanced. Nothing overdue.',
};

const PRIMARY_ACTION_PATH = {
  Engineering: 'backlog',
  Sales: 'pipeline',
  Support: 'queues',
  Marketing: 'campaigns',
  Operations: 'runbooks',
  Generic: 'lists',
};

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return null;
  return Math.max(0, Math.ceil((d - Date.now()) / 86400000));
}

function dateParts(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    d: String(d.getDate()).padStart(2, '0'),
    m: d.toLocaleString(undefined, { month: 'short' }),
  };
}

// Placeholder rollups per project type. Where we have real data
// (open tasks for Engineering), the value is computed; the rest stays
// sample-flagged until the per-type analytics endpoints ship (Phase 2).
function buildKpis(typeId, { openTasks, sprint, members }) {
  switch (typeId) {
    case 'Engineering':
      return [
        { label: 'Sprint', value: sprint?.name ?? '—', sub: sprint ? `${daysUntil(sprint.endDate) ?? '—'}d left` : 'No active sprint' },
        { label: 'Velocity', value: '34', sub: 'pts/wk', delta: '+8%', up: true, sample: true },
        { label: 'Bugs open', value: '7', sub: '2 urgent', delta: '-3', up: true, sample: true },
        { label: 'PRs in review', value: '5', sub: '2 stale', sample: true },
      ];
    case 'Sales':
      return [
        { label: 'Pipeline', value: '$1.26m', sub: '10 active', delta: '+12%', up: true, sample: true },
        { label: 'Win rate', value: '34%', sub: 'last 90d', delta: '+4pt', up: true, sample: true },
        { label: 'Avg cycle', value: '21d', sub: 'qualified→won', delta: '-2d', up: true, sample: true },
        { label: 'Quota', value: '68%', sub: 'of $1.8m', sample: true },
      ];
    case 'Support':
      return [
        { label: 'Open', value: '28', sub: '4 urgent', delta: '+3', up: false, sample: true },
        { label: 'SLA hit', value: '94%', sub: 'last 7d', delta: '+1pt', up: true, sample: true },
        { label: 'CSAT', value: '4.7', sub: '142 responses', sample: true },
        { label: 'Avg first reply', value: '12m', sub: 'business hrs', delta: '-3m', up: true, sample: true },
      ];
    case 'Marketing':
      return [
        { label: 'Campaigns', value: '4', sub: '2 launching', sample: true },
        { label: 'Scheduled', value: '15', sub: 'next 30d', delta: '+5', up: true, sample: true },
        { label: 'Reach', value: '124k', sub: 'this month', delta: '+18%', up: true, sample: true },
        { label: 'CTR', value: '3.2%', sub: 'avg paid', delta: '+0.4pt', up: true, sample: true },
      ];
    case 'Operations':
      return [
        { label: 'Active runs', value: '6', sub: '0 failed', sample: true },
        { label: 'Compliance', value: '98%', sub: 'controls met', delta: '+2pt', up: true, sample: true },
        { label: 'Next audit', value: 'Aug 1', sub: '10 days', sample: true },
        { label: 'Avg cycle', value: '4.2d', sub: 'per run', delta: '-0.5d', up: true, sample: true },
      ];
    case 'Generic':
    default:
      return [
        { label: 'Open', value: openTasks ?? 0, sub: 'tasks' },
        { label: 'In progress', value: '—', sub: 'sample', sample: true },
        { label: 'Done', value: '—', sub: 'this week', sample: true },
        { label: 'Members', value: members.length, sub: 'active' },
      ];
  }
}

export function ProjectHomePage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [epics, setEpics] = useState([]);
  const [openTasks, setOpenTasks] = useState(0);
  const [activeSprint, setActiveSprint] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        const [es, ts, sprint, ms] = await Promise.all([
          epicsApi.listForProject(p.id),
          tasksApi.listForProject(p.id, { include_done: false }).catch(() => []),
          sprintsApi.getActive(p.id).catch(() => null),
          projectsApi.listMembers(p.id).catch(() => []),
        ]);
        if (cancelled) return;
        setEpics(es);
        setOpenTasks(ts.length);
        setActiveSprint(sprint ?? null);
        setMembers(ms);
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
  const tone = TYPE_BADGE_TONE[typeId] ?? 'neutral';
  const iconClass = `proj-icon proj-icon-${typeId.toLowerCase()}`;

  const kpis = useMemo(
    () => (project ? buildKpis(typeId, { openTasks, sprint: activeSprint, members }) : []),
    [project, typeId, openTasks, activeSprint, members],
  );

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
        <div className="page-head">
          <Skeleton width="40%" height={28} />
          <div style={{ height: 8 }} />
          <Skeleton width="60%" height={14} />
        </div>
        <div className="grid-4" style={{ marginBottom: 'var(--s-9)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={92} radius="lg" />
          ))}
        </div>
        <div className="grid-12">
          <div className="col-8"><Skeleton height={320} radius="lg" /></div>
          <div className="col-4"><Skeleton height={320} radius="lg" /></div>
        </div>
      </div>
    );
  }

  const primaryPath = PRIMARY_ACTION_PATH[typeId] ?? 'backlog';
  const leadMember = members[0];

  return (
    <div className="main-inner project-home">
      <div className="page-head">
        <div className="row gap-3" style={{ marginBottom: 'var(--s-4)' }}>
          <Badge tone={tone}>
            <span className="badge-dot" />
            {meta?.label} project
          </Badge>
          <Chip>{vocab.hierarchy}</Chip>
          <AIChip label="AI: Suggest" />
        </div>
        <div className="page-title-row">
          <div className="row gap-5">
            <div
              className={iconClass}
              style={{ width: 52, height: 52, fontSize: 'var(--fs-xl)', borderRadius: 'var(--r-lg)' }}
            >
              {meta?.short?.[0] ?? <Briefcase size={22} />}
            </div>
            <div>
              <h1 className="page-title">{project.name}</h1>
              <p className="page-subtitle" style={{ marginTop: 6 }}>
                {leadMember ? `Led by ${leadMember.fullName} · ` : ''}
                {members.length} member{members.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="row gap-3">
            <AvatarStack people={members} max={5} size="sm" />
            <div className="divider-v" style={{ height: 24 }} />
            <Link to={`/${orgSlug}/projects/${projectSlug}/ai`}>
              <Button variant="ai" size="sm">
                <Sparkles size={13} aria-hidden="true" /> Ask AI
              </Button>
            </Link>
            <Button size="sm" disabled title="Coming in Phase 2">
              <MessageSquare size={14} aria-hidden="true" /> Discuss
            </Button>
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

      <div className="grid-4" style={{ marginBottom: 'var(--s-9)' }}>
        {kpis.map((k, i) => (
          <div key={i} className="stat">
            <div className="stat-label">
              {k.label}
              {k.sample && <span className="project-home-sample">sample</span>}
            </div>
            <div className="stat-row">
              <div className="stat-value">
                {k.value}
                {k.sub && (
                  <span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {' '}
                    {k.sub}
                  </span>
                )}
              </div>
              {k.delta && (
                <span className={`stat-delta stat-delta-${k.up ? 'up' : 'down'}`}>
                  {k.up ? <ArrowUp size={10} strokeWidth={3} /> : <ArrowDown size={10} strokeWidth={3} />}
                  {k.delta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-12">
        <div className="col-8 col">
          <div className="row between" style={{ marginBottom: 'var(--s-5)' }}>
            <h3 className="h-card">Activity</h3>
            <Button variant="ghost" size="sm" disabled title="Coming in Phase 2">
              <RefreshCw size={12} aria-hidden="true" /> Refresh
            </Button>
          </div>
          <div className="card">
            <div className="col">
              {PLACEHOLDER_ACTIVITY.map((a, i, list) => (
                <div
                  key={i}
                  className="row gap-4 project-home-activity-row"
                  style={{ borderBottom: i === list.length - 1 ? 0 : '1px solid var(--divider)' }}
                >
                  <div className={`project-home-activity-icon${a.ai ? ' is-ai' : ''}`}>
                    {a.ai ? <Sparkles size={14} /> : a.kind === 'pr' ? <GitPullRequest size={14} /> : a.kind === 'comment' ? <MessageSquare size={14} /> : <Check size={14} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row gap-3" style={{ marginBottom: 2 }}>
                      <strong style={{ fontSize: 'var(--fs-sm)' }}>{a.who}</strong>
                      {a.ai && <AIChip label="AI" />}
                      <span className="muted" style={{ fontSize: 'var(--fs-xs)', marginLeft: 'auto' }}>{a.time}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{a.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="muted project-home-placeholder-note">
            Activity feed shows sample data until the activity-log endpoint ships (Phase 2).
          </p>
        </div>

        <div className="col-4 col gap-5">
          <div className="ai-card">
            <div className="ai-card-body">
              <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
                <div className="ai-mark"><Sparkles size={14} /></div>
                <strong>Sprint health</strong>
              </div>
              <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-5)' }}>
                {SPRINT_HEALTH_COPY[typeId]}
              </p>
              <div className="row gap-3">
                <Link to={`/${orgSlug}/projects/${projectSlug}/ai`}>
                  <Button variant="ai" size="sm">
                    <Wand2 size={13} aria-hidden="true" /> Open suggestions
                  </Button>
                </Link>
                <Link to={`/${orgSlug}/projects/${projectSlug}/ai`}>
                  <Button size="sm">Ask anything</Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><strong>Upcoming</strong></div>
            <div className="col project-home-upcoming">
              {upcoming.length === 0 ? (
                <div className="muted" style={{ padding: 'var(--s-5) var(--s-6)', fontSize: 'var(--fs-sm)' }}>
                  No upcoming dates.
                </div>
              ) : (
                upcoming.map((e, i) => (
                  <div
                    key={e.key}
                    className="row gap-5 project-home-upcoming-row"
                    style={{ borderBottom: i === upcoming.length - 1 ? 0 : '1px solid var(--divider)' }}
                  >
                    <div className="col center project-home-upcoming-date">
                      <div className="project-home-upcoming-month">{e.m}</div>
                      <div className="project-home-upcoming-day">{e.d}</div>
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)' }}>{e.t}</div>
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

const PLACEHOLDER_ACTIVITY = [
  { ai: true, who: 'Drafted a sprint replan', time: '12m ago', body: 'Suggested cutting two tasks to keep the sprint on track.' },
  { kind: 'pr', who: 'Maya Singh', time: '34m ago', body: 'Opened PR #482 on feat/magic-link → moved task to In Review.' },
  { kind: 'comment', who: 'Theo Park', time: '1h ago', body: 'Commented on a blocked task: blocked on legal SSO clearance.' },
  { kind: 'check', who: 'Maya Singh', time: '2h ago', body: 'Closed a task — Splash skeleton loaders.' },
  { ai: true, who: 'Estimated 4 tasks', time: '3h ago', body: 'Effort estimates with 78% confidence across the next sprint.' },
];
