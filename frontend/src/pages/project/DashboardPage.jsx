import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AIChip,
  Avatar,
  Badge,
  Button,
  Icon,
  Skeleton,
} from '@/components/ui';
import {
  BurndownChart,
  HealthGauge,
  VelocityChart,
  WorkloadHeatmap,
} from '@/components/charts';
import { projectsApi } from '@/api/projects.api';
import { boardApi } from '@/api/board.api';
import { sprintsApi } from '@/api/sprints.api';
import { epicsApi } from '@/api/epics.api';
import { widgetsForType } from '@/components/dashboard/dashboardRegistry';
import { findProjectType } from '@/constants/projectTypes';
import './DashboardPage.css';

// Placeholder data — backend doesn't expose these aggregates yet (Phase 2).
// Banner at the top of the page flags this so the numbers aren't mistaken
// for real metrics.
const PLACEHOLDER_VELOCITY = [
  { name: 'S18', committed: 35, completed: 32 },
  { name: 'S19', committed: 38, completed: 38 },
  { name: 'S20', committed: 36, completed: 30 },
  { name: 'S21', committed: 40, completed: 42 },
  { name: 'S22', committed: 39, completed: 36 },
  { name: 'S23', committed: 42, completed: 41 },
];

const PLACEHOLDER_HEAT_DAYS = ['M', 'T', 'W', 'T', 'F', 'M', 'T', 'W', 'T', 'F'];

const PLACEHOLDER_HEAT_DATA = [
  { name: 'Priya', load: [3, 4, 5, 5, 4, 4, 3, 5, 5, 3] },
  { name: 'Marcus', load: [4, 5, 5, 4, 4, 5, 5, 5, 4, 4] },
  { name: 'Sasha', load: [2, 3, 3, 3, 2, 3, 3, 4, 3, 2] },
  { name: 'Diego', load: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
  { name: 'Hana', load: [3, 4, 4, 4, 3, 3, 4, 4, 3, 3] },
  { name: 'Aria', load: [1, 2, 3, 2, 2, 2, 3, 3, 2, 1] },
];

const PLACEHOLDER_ACTIVITY = [
  { who: 'Marcus Chen', color: 2, action: 'merged', target: 'ATLAS-244', time: '12m' },
  { who: 'Priya Patel', color: 1, action: 'commented on', target: 'ATLAS-247', time: '36m' },
  { who: 'Sasha Volkov', color: 3, action: 'linked', target: 'ATLAS-302 → INC-441', time: '1h' },
  { who: 'Stratos AI', color: 5, action: 'drafted plan for', target: 'EPIC-Onboarding', time: '3h', ai: true },
];

const HEALTH_SIGNALS = [
  ['Burn rate', 'var(--warning)', '+0.4d'],
  ['Blockers', 'var(--success)', '1'],
  ['Coverage', 'var(--success)', '94%'],
  ['WIP', 'var(--warning)', 'high'],
];

const EPIC_COLORS = ['#5B6AF0', '#4FD1E0', '#7A6BFF', '#C77BFF', '#3FB984', '#E0A23A', '#E5484D', '#4F9EFF'];

function epicColor(epic, idx) {
  return epic.color || EPIC_COLORS[idx % EPIC_COLORS.length];
}

function sumPts(board, predicate) {
  if (!board) return 0;
  let total = 0;
  for (const lane of board.swimlanes) {
    for (const col of lane.columns) {
      if (!predicate(col)) continue;
      for (const card of col.cards) total += card.storyPoints ?? 0;
    }
  }
  return total;
}

function buildBurndown(total, done, days, today) {
  if (!total || !days) return { actual: [], today: 0 };
  // Two-point projection: total at day 0, current remaining at today.
  // We interpolate the intermediate days for a smoother line — honest
  // about being a model, not real snapshots.
  const remaining = total - done;
  const actual = Array.from({ length: days + 1 }, (_, i) => {
    if (i > today) return null;
    if (today === 0) return total;
    const ratio = i / today;
    return total - (total - remaining) * ratio;
  });
  return { actual, today };
}

function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

// F1.5-08 dispatch shell. For non-Engineering project types we delegate
// the entire body to the per-type widget set registered in
// `dashboardRegistry`. Engineering keeps the original implementation
// inline below — the AC's "no page-level type branches" only applies to
// the *typed* renderers; Engineering is the legacy baseline.
export function DashboardPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (!cancelled) setProject(p);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load dashboard.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug]);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!project) {
    return (
      <div className="main-inner dashboard" aria-busy="true">
        <Skeleton width={200} height={20} />
        <div style={{ height: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={88} radius="md" />
          ))}
        </div>
      </div>
    );
  }

  const widgets = widgetsForType(project.type);
  if (widgets) return <TypedDashboard project={project} widgets={widgets} />;
  return <EngineeringDashboard project={project} />;
}

function TypedDashboard({ project, widgets }) {
  const meta = findProjectType(project.type);
  return (
    <div className="main-inner dashboard">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{project.name}</div>
            <h1 className="page-title row gap-3">
              <Icon name="bar-chart-3" size={18} /> Dashboard
              <Badge tone="neutral">{meta?.label ?? project.type}</Badge>
            </h1>
          </div>
        </div>
      </div>
      <div className="dashboard-typed-grid">
        {widgets.map((Widget, i) => (
          <Widget key={i} project={project} />
        ))}
      </div>
    </div>
  );
}

function EngineeringDashboard({ project }) {
  const [board, setBoard] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [epics, setEpics] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, s, eps] = await Promise.all([
          boardApi.get(project.id).catch(() => null),
          sprintsApi.getActive(project.id).catch(() => null),
          epicsApi.listForProject(project.id).catch(() => []),
        ]);
        if (cancelled) return;
        setBoard(b);
        setSprint(s);
        setEpics(eps);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load dashboard.');
      }
    })();
    return () => { cancelled = true; };
  }, [project.id]);

  // Live counts derived from board.
  const openTasks = useMemo(() => {
    if (!board) return 0;
    let n = 0;
    for (const lane of board.swimlanes) {
      for (const col of lane.columns) {
        if (col.status === 'Done' || col.status === 'WontDo') continue;
        n += col.cards.length;
      }
    }
    return n;
  }, [board]);

  const totalPts = sumPts(board, () => true);
  const donePts = sumPts(board, (col) => col.status === 'Done');
  const sprintTotal = totalPts;
  const sprintDone = donePts;

  // Burndown timing.
  const sprintLen = sprint ? daysBetween(sprint.startDate, sprint.endDate) : 0;
  const today = sprint
    ? Math.min(sprintLen, daysBetween(sprint.startDate, new Date().toISOString()))
    : 0;
  const daysLeft = Math.max(0, sprintLen - today);
  const { actual: burnPoints } = buildBurndown(sprintTotal, sprintDone, sprintLen, today);
  const idealAtToday = sprintLen ? sprintTotal * (1 - today / sprintLen) : 0;
  const actualAtToday = sprintTotal - sprintDone;
  const isBehind = actualAtToday > idealAtToday + 2;

  // Epic progress from real epics + board cards.
  const epicProgress = useMemo(() => {
    if (!epics || epics.length === 0) return [];
    const byEpic = {};
    if (board) {
      for (const lane of board.swimlanes) {
        for (const col of lane.columns) {
          for (const card of col.cards) {
            if (!card.epicId) continue;
            const entry = (byEpic[card.epicId] ??= { done: 0, total: 0 });
            entry.total += 1;
            if (col.status === 'Done') entry.done += 1;
          }
        }
      }
    }
    return epics
      .map((e, i) => ({
        id: e.id,
        name: e.title,
        color: epicColor(e, i),
        done: byEpic[e.id]?.done ?? 0,
        total: byEpic[e.id]?.total ?? 0,
      }))
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [epics, board]);

  // KPI tile values. On-track / bug ratio / cycle time stay as placeholders
  // for now; openTasks comes from the live board.
  const kpis = [
    { label: 'On track', value: '82%', delta: '+4%', tone: 'success', icon: 'trending-up', placeholder: true },
    {
      label: 'Open tasks',
      value: openTasks,
      delta: null,
      tone: 'info',
      icon: 'list-checks',
      placeholder: false,
    },
    { label: 'Bug ratio', value: '11%', delta: '−2%', tone: 'success', icon: 'bug', placeholder: true },
    { label: 'Avg cycle time', value: '3.2d', delta: '+0.4d', tone: 'warning', icon: 'clock', placeholder: true },
  ];

  if (error) return <p className="muted">{error}</p>;

  return (
    <div className="main-inner dashboard">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{project.name} · Insights</div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle" style={{ marginTop: 8 }}>
              Live snapshot · last 30 days
            </p>
          </div>
          <div className="row gap-3">
            <Button size="sm" disabled title="Coming in Phase 2">
              <Icon name="calendar" size={13} /> Last 30 days
            </Button>
            <Button variant="primary" size="sm" disabled title="Coming in Phase 2">
              <Icon name="plus" size={13} /> Add widget
            </Button>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 'var(--s-7)' }}>
        {kpis.map((k) => (
          <div key={k.label} className="stat">
            <div className="stat-label">
              {k.label}
              {k.placeholder && <span className="dashboard-sample">sample</span>}
            </div>
            <div className="stat-row">
              <div className="stat-value">{k.value}</div>
              {k.delta && (
                <span className={`stat-delta stat-delta-${k.tone === 'success' ? 'up' : k.tone === 'warning' || k.tone === 'danger' ? 'down' : 'up'}`}>
                  {k.delta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-12">
        {/* Sprint burndown — col-8 */}
        <div className="card col-8">
          <div className="card-header">
            <strong>Sprint burndown</strong>
            {sprint && (
              <Badge tone={isBehind ? 'warning' : 'success'} dot>
                {isBehind ? 'Behind ideal' : 'On track'}
              </Badge>
            )}
          </div>
          <div className="card-body">
            <div className="muted dashboard-sub">
              {sprint
                ? `${sprint.name} · ${sprintDone} / ${sprintTotal} pt · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                : 'No active sprint'}
            </div>
            <BurndownChart
              total={sprintTotal || 41}
              actual={sprint ? burnPoints : [41, 39, 36, 34, 33, 31, 28, 28, 26, 24, 22]}
              today={sprint ? today : 10}
              days={sprintLen || 14}
              width={520}
              height={150}
            />
          </div>
        </div>

        {/* Project health — col-4 */}
        <div className="card col-4">
          <div className="card-header">
            <strong>Project health <span className="dashboard-sample">sample</span></strong>
            <Badge tone="success">Healthy</Badge>
          </div>
          <div className="card-body center">
            <HealthGauge score={78} />
            <div className="col gap-3 dashboard-signals">
              {HEALTH_SIGNALS.map(([label, color, value]) => (
                <div key={label} className="row between" style={{ fontSize: 'var(--fs-sm)' }}>
                  <span className="row gap-3">
                    <span className="dashboard-signal-dot" style={{ background: color }} />
                    {label}
                  </span>
                  <span className="mono muted">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Velocity — col-8 */}
        <div className="card col-8">
          <div className="card-header">
            <strong>Velocity <span className="dashboard-sample">sample</span></strong>
            <div className="row gap-4" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              <span className="row gap-2">
                <span className="dashboard-legend-swatch" style={{ background: 'var(--surface-hover)' }} />
                Committed
              </span>
              <span className="row gap-2">
                <span className="dashboard-legend-swatch" style={{ background: 'var(--accent)' }} />
                Completed
              </span>
            </div>
          </div>
          <div className="card-body">
            <VelocityChart
              sprints={[
                ...PLACEHOLDER_VELOCITY,
                {
                  name: sprint?.name ?? 'S24',
                  committed: sprintTotal || 41,
                  completed: sprintDone || 26,
                  current: true,
                },
              ]}
              width={520}
              height={150}
            />
          </div>
        </div>

        {/* Epic progress (live) — col-4 */}
        <div className="card col-4">
          <div className="card-header"><strong>Epic progress</strong></div>
          <div className="card-body">
            {epicProgress.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>No epics with tasks yet.</p>
            ) : (
              <div className="col gap-4">
                {epicProgress.map((e) => {
                  const pct = e.total > 0 ? e.done / e.total : 0;
                  return (
                    <div key={e.id}>
                      <div className="row between" style={{ marginBottom: 4 }}>
                        <span className="row gap-3">
                          <span className="dashboard-epic-swatch" style={{ background: e.color }} />
                          <span className="truncate" style={{ fontSize: 'var(--fs-sm)' }}>{e.name}</span>
                        </span>
                        <span className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {e.done}/{e.total}
                        </span>
                      </div>
                      <div className="dashboard-epic-track">
                        <div className="dashboard-epic-fill" style={{ width: `${pct * 100}%`, background: e.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Workload heatmap — col-8 */}
        <div className="card col-8">
          <div className="card-header">
            <strong>Team workload <span className="dashboard-sample">sample</span></strong>
            <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>last 2 weeks · daily pts</span>
          </div>
          <div className="card-body">
            <WorkloadHeatmap days={PLACEHOLDER_HEAT_DAYS} data={PLACEHOLDER_HEAT_DATA} />
          </div>
        </div>

        {/* AI weekly insight — col-4 */}
        <div className="ai-card col-4">
          <div className="ai-card-body">
            <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
              <div className="ai-mark"><Icon name="sparkles" size={14} /></div>
              <strong>Weekly insight</strong>
              <span className="dashboard-sample" style={{ marginLeft: 'auto' }}>sample</span>
            </div>
            <div className="dashboard-insight-title">You'll likely miss this sprint by ~12 pt</div>
            <p className="muted dashboard-insight-body">
              Two blockers are accruing time on Auth hardening. Marcus is at 95% capacity. Moving 12 pt to the next sprint keeps velocity within trend.
            </p>
            <Button variant="ai" size="sm" disabled title="Phase 2">
              See full report <Icon name="arrow-right" size={12} />
            </Button>
          </div>
        </div>

        {/* Recent activity — col-12 */}
        <div className="card col-12">
          <div className="card-header"><strong>Recent activity <span className="dashboard-sample">sample</span></strong></div>
          <div className="col">
            {PLACEHOLDER_ACTIVITY.map((a, i, list) => (
              <div
                key={i}
                className="row gap-4 dashboard-activity"
                style={{ borderBottom: i === list.length - 1 ? 0 : '1px solid var(--divider)' }}
              >
                {a.ai ? (
                  <span className="ai-mark" style={{ width: 24, height: 24, borderRadius: 'var(--r-sm)' }}>
                    <Icon name="sparkles" size={10} color="#fff" />
                  </span>
                ) : (
                  <Avatar name={a.who} color={a.color} size="xs" />
                )}
                <span className="dashboard-activity-text">
                  <span style={{ fontWeight: 500 }}>{a.who}</span>{' '}
                  <span className="muted">{a.action}</span>{' '}
                  <span className="mono" style={{ color: 'var(--accent)' }}>{a.target}</span>
                </span>
                <span className="mono muted dashboard-activity-time">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
