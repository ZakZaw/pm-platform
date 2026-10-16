// F2-04: engineering dashboard widget registry. Each entry knows its own
// id, default grid size, and how to render itself given the shared `ctx`
// that DashboardPage builds once per data fetch. Widgets stay declarative —
// no data-fetching here, EXCEPT for the activity feed widget which fetches
// its own paged history (see ActivityFeedWidget below).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Avatar, Icon, Skeleton } from '@/components/ui';
import {
  BurndownChart,
  EpicProgressBars,
  HealthGauge,
  VelocityChart,
  WorkloadHeatmap,
} from '@/components/charts';
import { activityApi } from '@/api/activity.api';
import './DashboardWidget.css';

// Short header label for the weekly-insight tone read-out.
const INSIGHT_TONE_LABEL = {
  success: 'On track',
  warning: 'Watch',
  danger: 'At risk',
  info: 'FYI',
};

// KPI ratios render an em dash when the backend can't compute them yet (null)
// rather than a misleading zero.
const pct = (v) => (v == null ? '—' : `${Math.round(v)}%`);

// Dot + coloured text status read-out (no capsule).
function Tone({ tone = 'neutral', children }) {
  return <span className={`dash-tone dash-tone-${tone}`}>{children}</span>;
}

// Measures its own box so SVG charts render at the widget's real size (the
// canvas is resizable) while the chart components keep their explicit
// width/height props.
function ChartFrame({ minHeight = 120, children }) {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { w: Math.floor(r.width), h: Math.max(minHeight, Math.floor(r.height)) };
      setSize((cur) => (cur && cur.w === next.w && cur.h === next.h ? cur : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minHeight]);
  return (
    <div ref={ref} className="dash-chart">
      {size && size.w > 0 && children(size.w, size.h)}
    </div>
  );
}

function KpiCard({ label, value, delta, tone = 'info' }) {
  return (
    <div className="dash-kpi">
      <div className="dash-kpi-label">{label}</div>
      <div className="dash-kpi-row">
        <div className="dash-kpi-value">{value}</div>
        {delta && (
          <span className={`stat-delta stat-delta-${tone === 'warning' || tone === 'danger' ? 'down' : 'up'}`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

function WidgetHead({ title, children }) {
  return (
    <header className="dash-card-head">
      <h3 className="dash-card-title">{title}</h3>
      {children}
    </header>
  );
}

function Empty({ children }) {
  return <p className="dash-empty">{children}</p>;
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
          <WidgetHead title="Sprint burndown">
            {hasSprint && (
              <Tone tone={isBehind ? 'warning' : 'success'}>
                {isBehind ? 'Behind ideal' : 'On track'}
              </Tone>
            )}
          </WidgetHead>
          <div className="dash-card-body">
            <div className="dash-sub">
              {hasSprint
                ? `${burndown.sprintName} · ${done} / ${total} pt · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                : 'No active sprint'}
            </div>
            {hasSprint ? (
              <>
                <ChartFrame>
                  {(w, h) => <BurndownChart total={total} actual={actual} today={today} days={days} width={w} height={h} />}
                </ChartFrame>
                <div className="dash-legend">
                  <span className="dash-legend-item"><span className="dash-legend-line" />Remaining</span>
                  <span className="dash-legend-item"><span className="dash-legend-dash" />Ideal</span>
                </div>
              </>
            ) : (
              <Empty>Start a sprint to see its burndown.</Empty>
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
          <WidgetHead title="Project health">
            {health && <Tone tone={bandTone}>{health.band}</Tone>}
          </WidgetHead>
          <div className="dash-card-body center">
            <HealthGauge score={score} size={128} stroke={9} />
            <div className="dash-signals">
              {signals.map((s) => (
                <div key={s.label} className="dash-signal">
                  <Tone tone={s.tone}>{s.label}</Tone>
                  <span className="dash-signal-value">{s.value}</span>
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
        <WidgetHead title="Velocity">
          <div className="dash-legend">
            <span className="dash-legend-item"><span className="dash-legend-swatch is-muted" />Committed</span>
            <span className="dash-legend-item"><span className="dash-legend-swatch" />Completed</span>
            <span className="dash-legend-item"><span className="dash-legend-dash" />Avg</span>
          </div>
        </WidgetHead>
        <div className="dash-card-body">
          {(velocity?.length ?? 0) === 0 ? (
            <Empty>No sprint history yet. Close a sprint to start tracking velocity.</Empty>
          ) : (
            <ChartFrame>
              {(w, h) => (
                <VelocityChart
                  sprints={velocity.map((v) => ({
                    name: v.name,
                    committed: v.committed,
                    completed: v.completed,
                    rollingAverage: v.rollingAverage,
                    current: v.current,
                  }))}
                  width={w}
                  height={h}
                />
              )}
            </ChartFrame>
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
        <WidgetHead title="Epic progress" />
        <div className="dash-card-body">
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
          <WidgetHead title="Team workload">
            <span className="dash-meta">Tasks done per day · last 10 days</span>
          </WidgetHead>
          <div className="dash-card-body">
            {data.length === 0 ? (
              <Empty>No team members on this project yet.</Empty>
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
      <div className="dash-card">
        <header className="dash-card-head">
          <div className="dash-insight-title-row">
            <span className="ai-mark dash-insight-mark"><Icon name="sparkles" size={13} /></span>
            <h3 className="dash-card-title">Weekly insight</h3>
          </div>
          {insight && (
            <Tone tone={insight.tone}>
              {INSIGHT_TONE_LABEL[insight.tone] ?? 'Insight'}
            </Tone>
          )}
        </header>
        <div className="dash-card-body">
          {insight ? (
            <>
              <div className="dash-insight-headline">{insight.headline}</div>
              <p className="dash-insight-body">{insight.detail}</p>
              {insight.highlights?.length > 0 && (
                <ul className="dash-insight-highlights">
                  {insight.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Empty>No insight to show yet.</Empty>
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
      <WidgetHead title="Recent activity" />
      <div className="dash-activity">
        {entries === null && !error && <Skeleton height={14} width="60%" />}
        {error && <Empty>{error}</Empty>}
        {entries && entries.length === 0 && !error && <Empty>No activity in this project yet.</Empty>}
        {entries && entries.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ entry }) {
  const actorName = entry.actor?.fullName ?? 'Someone';
  const phrase = VERB_PHRASE[entry.verb] ?? entry.verb;
  const targetLabel = TARGET_LABEL[entry.targetType] ?? entry.targetType.toLowerCase();
  // Summary, when present, is the rich phrase produced by the recorder
  // ("moved Auth epic to next quarter"). Otherwise we fall back to a
  // generic "{verb} the {targetType}" line.
  const summary = entry.summary?.trim();
  return (
    <div className="dash-activity-row">
      <Avatar name={actorName} src={entry.actor?.avatarUrl} size="sm" />
      <span className="dash-activity-text">
        <span className="dash-activity-actor">{actorName}</span>{' '}
        <span className="muted">{summary || `${phrase} the ${targetLabel}`}</span>
      </span>
      <span className="dash-activity-time" title={new Date(entry.createdAt).toLocaleString()}>
        {relativeTime(entry.createdAt)}
      </span>
    </div>
  );
}
