// F2-04: engineering dashboard widget registry. Each entry knows its own
// id, default grid size, and how to render itself given the shared `ctx`
// that DashboardPage builds once per data fetch. Widgets stay declarative —
// no data-fetching here, EXCEPT for the activity feed widget which fetches
// its own paged history (see ActivityFeedWidget below).

import { useEffect, useState } from 'react';
import { Avatar, Badge, Icon, Skeleton } from '@/components/ui';
import {
  BurndownChart,
  EpicProgressBars,
  HealthGauge,
  VelocityChart,
  WorkloadHeatmap,
} from '@/components/charts';
import { activityApi } from '@/api/activity.api';

// Maps a backend signal tone keyword to its design token color.
const TONE_COLOR = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
};

// Short header label for the weekly-insight tone badge.
const INSIGHT_TONE_LABEL = {
  success: 'On track',
  warning: 'Watch',
  danger: 'At risk',
  info: 'FYI',
};

// KPI ratios render an em dash when the backend can't compute them yet (null)
// rather than a misleading zero.
const pct = (v) => (v == null ? '—' : `${Math.round(v)}%`);

function KpiCard({ label, value, delta, tone = 'info' }) {
  return (
    <div className="dash-kpi">
      <div className="dash-kpi__label">{label}</div>
      <div className="dash-kpi__row">
        <div className="dash-kpi__value">{value}</div>
        {delta && (
          <span className={`stat-delta stat-delta-${tone === 'success' ? 'up' : tone === 'warning' || tone === 'danger' ? 'down' : 'up'}`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

// Widget registry. Order here drives the default layout. Adding a new
// widget = new entry; the canvas + add-widget picker pick it up automatically.
export const ENGINEERING_WIDGETS = [
  {
    id: 'kpi-on-track',
    title: 'On track',
    defaults: { w: 3, h: 2, minW: 2, minH: 2, maxH: 3 },
    render: ({ kpis }) => (
      <KpiCard
        label="On track"
        value={pct(kpis?.onTrackPct)}
        tone={(kpis?.onTrackPct ?? 100) >= 90 ? 'success' : 'warning'}
      />
    ),
  },
  {
    id: 'kpi-open-tasks',
    title: 'Open tasks',
    defaults: { w: 3, h: 2, minW: 2, minH: 2, maxH: 3 },
    render: ({ openTasks }) => <KpiCard label="Open tasks" value={openTasks} tone="info" />,
  },
  {
    id: 'kpi-bug-ratio',
    title: 'Bug ratio',
    defaults: { w: 3, h: 2, minW: 2, minH: 2, maxH: 3 },
    render: ({ kpis }) => (
      <KpiCard
        label="Bug ratio"
        value={pct(kpis?.bugRatioPct)}
        tone={(kpis?.bugRatioPct ?? 0) <= 15 ? 'success' : 'warning'}
      />
    ),
  },
  {
    id: 'kpi-cycle-time',
    title: 'Avg cycle time',
    defaults: { w: 3, h: 2, minW: 2, minH: 2, maxH: 3 },
    render: ({ kpis }) => (
      <KpiCard
        label="Avg cycle time"
        value={kpis?.avgCycleDays == null ? '—' : `${kpis.avgCycleDays}d`}
        tone={(kpis?.avgCycleDays ?? 0) <= 4 ? 'success' : 'warning'}
      />
    ),
  },
  {
    id: 'burndown',
    title: 'Sprint burndown',
    defaults: { w: 8, h: 5, minW: 4, minH: 4 },
    render: ({ burndown }) => {
      const points = burndown?.points ?? [];
      const actual = points.map((p) => p.remaining);
      const total = burndown?.totalPoints ?? 0;
      const days = burndown?.days ?? 14;
      const today = burndown?.todayIndex ?? 0;
      const hasSprint = !!burndown?.sprintId;
      // Current remaining = last non-null sample; done = burned-down points.
      const remainingNow = [...actual].reverse().find((v) => v != null) ?? total;
      const done = total - remainingNow;
      const daysLeft = Math.max(0, days - today);
      const idealNow = days ? total * (1 - today / days) : 0;
      const isBehind = remainingNow > idealNow + 2;
      return (
        <div className="dash-card">
          <header className="dash-card__head">
            <strong>Sprint burndown</strong>
            {hasSprint && (
              <Badge tone={isBehind ? 'warning' : 'success'} dot>
                {isBehind ? 'Behind ideal' : 'On track'}
              </Badge>
            )}
          </header>
          <div className="dash-card__body">
            <div className="muted dashboard-sub">
              {hasSprint
                ? `${burndown.sprintName} · ${done} / ${total} pt · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                : 'No active sprint'}
            </div>
            {hasSprint ? (
              <BurndownChart total={total} actual={actual} today={today} days={days} width={520} height={150} />
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
                Start a sprint to see its burndown.
              </p>
            )}
          </div>
        </div>
      );
    },
  },
  {
    id: 'project-health',
    title: 'Project health',
    defaults: { w: 4, h: 5, minW: 3, minH: 4 },
    render: ({ health }) => {
      const score = health?.score ?? 0;
      const bandTone = score >= 75 ? 'success' : score >= 50 ? 'warning' : 'danger';
      const signals = health?.signals ?? [];
      return (
        <div className="dash-card">
          <header className="dash-card__head">
            <strong>Project health</strong>
            {health && <Badge tone={bandTone}>{health.band}</Badge>}
          </header>
          <div className="dash-card__body center">
            <HealthGauge score={score} />
            <div className="col gap-3 dashboard-signals">
              {signals.map((s) => (
                <div key={s.label} className="row between" style={{ fontSize: 'var(--fs-sm)' }}>
                  <span className="row gap-3">
                    <span
                      className="dashboard-signal-dot"
                      style={{ background: TONE_COLOR[s.tone] ?? 'var(--text-muted)' }}
                    />
                    {s.label}
                  </span>
                  <span className="mono muted">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: 'velocity',
    title: 'Velocity',
    defaults: { w: 8, h: 5, minW: 4, minH: 4 },
    render: ({ velocity }) => (
      <div className="dash-card">
        <header className="dash-card__head">
          <strong>Velocity</strong>
          <div className="row gap-4" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
            <span className="row gap-2">
              <span className="dashboard-legend-swatch" style={{ background: 'var(--surface-hover)' }} />
              Committed
            </span>
            <span className="row gap-2">
              <span className="dashboard-legend-swatch" style={{ background: 'var(--accent)' }} />
              Completed
            </span>
            <span className="row gap-2">
              <span className="dashboard-legend-swatch" style={{ background: 'var(--ai-2)' }} />
              Avg
            </span>
          </div>
        </header>
        <div className="dash-card__body">
          {(velocity?.length ?? 0) === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
              No sprint history yet. Close a sprint to start tracking velocity.
            </p>
          ) : (
            <VelocityChart
              sprints={velocity.map((v) => ({
                name: v.name,
                committed: v.committed,
                completed: v.completed,
                rollingAverage: v.rollingAverage,
                current: v.current,
              }))}
              width={520}
              height={150}
            />
          )}
        </div>
      </div>
    ),
  },
  {
    id: 'epic-progress',
    title: 'Epic progress',
    defaults: { w: 4, h: 5, minW: 3, minH: 3 },
    render: ({ epicProgress }) => (
      <div className="dash-card">
        <header className="dash-card__head"><strong>Epic progress</strong></header>
        <div className="dash-card__body">
          <EpicProgressBars epics={epicProgress ?? []} metric="points" limit={6} />
        </div>
      </div>
    ),
  },
  {
    id: 'workload',
    title: 'Team workload',
    defaults: { w: 8, h: 5, minW: 4, minH: 4 },
    render: ({ workload }) => {
      const days = workload?.days ?? [];
      const data = (workload?.members ?? []).map((m) => ({ name: m.name, load: m.load }));
      return (
        <div className="dash-card">
          <header className="dash-card__head">
            <strong>Team workload</strong>
            <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>last 10 days · tasks done/day</span>
          </header>
          <div className="dash-card__body">
            {data.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
                No team members on this project yet.
              </p>
            ) : (
              <WorkloadHeatmap days={days} data={data} />
            )}
          </div>
        </div>
      );
    },
  },
  {
    id: 'ai-insight',
    title: 'Weekly insight',
    defaults: { w: 4, h: 5, minW: 3, minH: 4 },
    render: ({ insight }) => (
      <div className="ai-card" style={{ height: '100%' }}>
        <div className="ai-card-body">
          <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
            <div className="ai-mark"><Icon name="sparkles" size={14} /></div>
            <strong>Weekly insight</strong>
            {insight && (
              <span style={{ marginLeft: 'auto' }}>
                <Badge tone={insight.tone === 'info' ? 'info' : insight.tone} dot>
                  {INSIGHT_TONE_LABEL[insight.tone] ?? 'Insight'}
                </Badge>
              </span>
            )}
          </div>
          {insight ? (
            <>
              <div className="dashboard-insight-title">{insight.headline}</div>
              <p className="muted dashboard-insight-body">{insight.detail}</p>
              {insight.highlights?.length > 0 && (
                <div className="dashboard-insight-chips">
                  {insight.highlights.map((h) => (
                    <span key={h} className="dashboard-insight-chip">{h}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="muted dashboard-insight-body">No insight to show yet.</p>
          )}
        </div>
      </div>
    ),
  },
  {
    id: 'activity',
    title: 'Recent activity',
    defaults: { w: 12, h: 4, minW: 6, minH: 3 },
    render: ({ project, activityVersion }) => (
      <ActivityFeedWidget project={project} refreshKey={activityVersion} />
    ),
  },
];

// ---------- Activity feed (F2-04 wire-up) ----------

// Human-facing verb phrase. The backend produces a Summary string for some
// verbs (e.g. "moved Auth epic to next quarter"); when present we prefer it
// over our default phrase so the feed reads naturally.
const VERB_PHRASE = {
  TaskCreated: 'created',
  TaskStatusChanged: 'changed the status of',
  TaskAssigned: 'assigned',
  TaskDeleted: 'deleted',
  EpicCreated: 'created the epic',
  EpicUpdated: 'updated the epic',
  EpicDatesChanged: 'rescheduled the epic',
  EpicArchived: 'archived the epic',
  MilestoneCreated: 'added the milestone',
  MilestoneUpdated: 'updated the milestone',
  MilestoneDeleted: 'removed the milestone',
  SprintStarted: 'started the sprint',
  SprintClosed: 'closed the sprint',
  CommentAdded: 'commented on',
  EpicDependencyAdded: 'linked an epic dependency',
  EpicDependencyRemoved: 'removed an epic dependency',
};

const TARGET_LABEL = {
  Task: 'task',
  Epic: 'epic',
  Sprint: 'sprint',
  Milestone: 'milestone',
  EpicDependency: 'dependency',
};

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}

function ActivityFeedWidget({ project, refreshKey }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!project?.id) return undefined;
    let cancelled = false;
    setError(null);
    activityApi
      .listForProject(project.id, { limit: 12 })
      .then((r) => { if (!cancelled) setEntries(r.entries ?? []); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load activity.'); });
    return () => { cancelled = true; };
  }, [project?.id, refreshKey]);

  return (
    <div className="dash-card">
      <header className="dash-card__head"><strong>Recent activity</strong></header>
      <div className="col" style={{ overflowY: 'auto' }}>
        {entries === null && !error && (
          <div style={{ padding: 'var(--s-5) var(--s-7)' }}>
            <Skeleton height={14} width="60%" />
          </div>
        )}
        {error && (
          <p className="muted" style={{ padding: 'var(--s-5) var(--s-7)', fontSize: 'var(--fs-sm)' }}>
            {error}
          </p>
        )}
        {entries && entries.length === 0 && !error && (
          <p className="muted" style={{ padding: 'var(--s-5) var(--s-7)', margin: 0, fontSize: 'var(--fs-sm)' }}>
            No activity in this project yet.
          </p>
        )}
        {entries && entries.map((entry, i, list) => (
          <ActivityRow key={entry.id} entry={entry} isLast={i === list.length - 1} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ entry, isLast }) {
  const actorName = entry.actor?.fullName ?? 'Someone';
  const phrase = VERB_PHRASE[entry.verb] ?? entry.verb;
  const targetLabel = TARGET_LABEL[entry.targetType] ?? entry.targetType.toLowerCase();
  // Summary, when present, is the rich phrase produced by the recorder
  // ("moved Auth epic to next quarter"). Otherwise we fall back to a
  // generic "{verb} the {targetType}" line.
  const summary = entry.summary?.trim();
  return (
    <div
      className="row gap-4 dashboard-activity"
      style={{ borderBottom: isLast ? 0 : '1px solid var(--divider)' }}
    >
      <Avatar
        name={actorName}
        src={entry.actor?.avatarUrl}
        size="xs"
      />
      <span className="dashboard-activity-text">
        <span style={{ fontWeight: 500 }}>{actorName}</span>{' '}
        {summary ? (
          <span className="muted">{summary}</span>
        ) : (
          <>
            <span className="muted">{phrase} the </span>
            <span className="mono" style={{ color: 'var(--accent)' }}>{targetLabel}</span>
          </>
        )}
      </span>
      <span className="mono muted dashboard-activity-time" title={new Date(entry.createdAt).toLocaleString()}>
        {relativeTime(entry.createdAt)}
      </span>
    </div>
  );
}
