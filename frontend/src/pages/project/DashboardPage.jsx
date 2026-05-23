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
  ['Burn rate', 'var(--status-warning)', '+0.4d'],
  ['Blockers', 'var(--status-success)', '1'],
  ['Coverage', 'var(--status-success)', '94%'],
  ['WIP', 'var(--status-warning)', 'high'],
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

  if (error) return <p className="dashboard__placeholder">{error}</p>;
  if (!project) {
    return (
      <div className="dashboard" aria-busy="true" style={{ padding: 20 }}>
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
    <div className="dashboard">
      <header className="page-header">
        <div className="hstack" style={{ gap: 8 }}>
          <Icon name="bar-chart-3" size={14} />
          <div className="page-title">Dashboard</div>
          <Badge tone="neutral">{meta?.label ?? project.type}</Badge>
        </div>
      </header>
      <div className="dashboard__typed-grid">
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

  if (error) return <p className="dashboard__placeholder">{error}</p>;

  return (
    <div className="dashboard">
      <header className="page-header">
        <div className="hstack" style={{ gap: 8 }}>
          <Icon name="bar-chart-3" size={14} />
          <div className="page-title">Dashboard</div>
          <Badge tone="neutral">Last 30d</Badge>
        </div>
        <div className="grow" />
        <div className="hstack" style={{ gap: 6 }}>
          <Button variant="secondary" size="md" disabled>
            <Icon name="calendar" size={13} /> Last 30 days
          </Button>
          <Button variant="secondary" size="md" disabled>
            <Icon name="share-2" size={13} /> Share
          </Button>
          <Button variant="primary" size="md" disabled title="Coming in Phase 2">
            <Icon name="plus" size={13} /> Add widget
          </Button>
        </div>
      </header>

      <div className="dashboard__note">
        <Icon name="info" size={12} />
        <span>
          Velocity, workload, health signals, and activity feed use sample data until the
          analytics backend ships (Phase 2). KPIs labelled with <em>sample</em> are the same.
        </span>
      </div>

      <div className="dashboard__grid">
        {/* KPI strip */}
        {kpis.map((k) => (
          <div key={k.label} className="card dashboard__kpi">
            <div className="hstack dashboard__kpi-head">
              <span
                className="dashboard__kpi-icon"
                style={{
                  background: `var(--status-${k.tone}-bg)`,
                  color: `var(--status-${k.tone})`,
                }}
              >
                <Icon name={k.icon} size={12} />
              </span>
              <span className="dashboard__kpi-label">
                {k.label}
                {k.placeholder && <span className="dashboard__sample"> · sample</span>}
              </span>
            </div>
            <div className="hstack dashboard__kpi-body">
              <div className="dashboard__kpi-value">{k.value}</div>
              {k.delta && (
                <div className="mono dashboard__kpi-delta" style={{ color: `var(--status-${k.tone})` }}>
                  {k.delta}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Burndown */}
        <div className="card dashboard__wide">
          <div className="hstack dashboard__widget-head">
            <div>
              <div className="dashboard__widget-title">Sprint burndown</div>
              <div className="muted dashboard__widget-sub">
                {sprint
                  ? `${sprint.name} · ${sprintDone} / ${sprintTotal} pt · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                  : 'No active sprint'}
              </div>
            </div>
            {sprint && (
              <Badge tone={isBehind ? 'warning' : 'success'}>
                {isBehind ? 'Behind ideal' : 'On track'}
              </Badge>
            )}
          </div>
          <div className="dashboard__chart-wrap">
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

        {/* Velocity */}
        <div className="card dashboard__wide">
          <div className="hstack dashboard__widget-head">
            <div>
              <div className="dashboard__widget-title">
                Velocity <span className="dashboard__sample">· sample</span>
              </div>
              <div className="muted dashboard__widget-sub">Last 7 sprints · committed vs. completed</div>
            </div>
            <div className="hstack dashboard__legend">
              <span className="hstack">
                <span className="dashboard__legend-swatch" style={{ background: 'var(--bg-surface-3)' }} />
                Committed
              </span>
              <span className="hstack">
                <span
                  className="dashboard__legend-swatch"
                  style={{ background: 'var(--accent-primary)' }}
                />
                Completed
              </span>
            </div>
          </div>
          <div className="dashboard__chart-wrap">
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

        {/* Health gauge */}
        <div className="card dashboard__col-4 dashboard__health">
          <div className="hstack dashboard__widget-head" style={{ width: '100%' }}>
            <div>
              <div className="dashboard__widget-title">
                Project health <span className="dashboard__sample">· sample</span>
              </div>
              <div className="muted dashboard__widget-sub">composite — 6 signals</div>
            </div>
            <Badge tone="success">Healthy</Badge>
          </div>
          <HealthGauge score={78} />
          <div className="dashboard__signals">
            {HEALTH_SIGNALS.map(([label, color, value]) => (
              <div key={label} className="hstack dashboard__signal">
                <span className="hstack" style={{ gap: 6 }}>
                  <span className="dashboard__signal-dot" style={{ background: color }} />
                  {label}
                </span>
                <span className="mono dim">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Epic progress (live) */}
        <div className="card dashboard__col-4">
          <div className="dashboard__widget-title" style={{ marginBottom: 10 }}>
            Epic progress
          </div>
          {epicProgress.length === 0 && (
            <p className="dashboard__placeholder" style={{ padding: 0, fontSize: 12 }}>
              No epics with tasks yet.
            </p>
          )}
          <div className="vstack" style={{ gap: 10 }}>
            {epicProgress.map((e) => {
              const pct = e.total > 0 ? e.done / e.total : 0;
              return (
                <div key={e.id}>
                  <div className="hstack dashboard__epic-head">
                    <span className="hstack" style={{ gap: 6 }}>
                      <span className="dashboard__epic-swatch" style={{ background: e.color }} />
                      <span className="truncate">{e.name}</span>
                    </span>
                    <span className="mono dim" style={{ fontSize: 11 }}>
                      {e.done}/{e.total}
                    </span>
                  </div>
                  <div className="dashboard__epic-track">
                    <div
                      className="dashboard__epic-fill"
                      style={{ width: `${pct * 100}%`, background: e.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI weekly insight */}
        <div className="card-ai dashboard__col-4">
          <div className="hstack" style={{ gap: 8, marginBottom: 8 }}>
            <AIChip label="Weekly insight" variant="soft" />
            <span className="muted" style={{ fontSize: 11 }}>
              · Sample insight
            </span>
          </div>
          <div className="dashboard__insight-title">You'll likely miss this sprint by ~12 pt</div>
          <div className="muted dashboard__insight-body">
            Two blockers are accruing time on Auth hardening. Marcus is at 95% capacity. Moving 12 pt to the next sprint keeps velocity within trend.
          </div>
          <div className="vstack" style={{ gap: 5, marginBottom: 12, fontSize: 12 }}>
            <div className="hstack" style={{ gap: 6 }}>
              <Icon name="dot" size={14} color="var(--ai-violet)" />
              Coverage drift detected on /payments
            </div>
            <div className="hstack" style={{ gap: 6 }}>
              <Icon name="dot" size={14} color="var(--ai-violet)" />
              Sasha's review queue grew 3× this week
            </div>
            <div className="hstack" style={{ gap: 6 }}>
              <Icon name="dot" size={14} color="var(--ai-violet)" />
              Cycle time creeping past 3d threshold
            </div>
          </div>
          <Button variant="ai" size="sm" disabled title="Phase 2">
            See full report <Icon name="arrow-right" size={12} />
          </Button>
        </div>

        {/* Workload heatmap */}
        <div className="card dashboard__col-8">
          <div className="hstack dashboard__widget-head">
            <div>
              <div className="dashboard__widget-title">
                Team workload <span className="dashboard__sample">· sample</span>
              </div>
              <div className="muted dashboard__widget-sub">Daily story-points assigned · last 2 weeks</div>
            </div>
            <div className="hstack dashboard__legend">
              <span className="hstack">
                <span
                  className="dashboard__legend-swatch"
                  style={{ background: 'rgba(91,106,240,0.45)' }}
                />
                Healthy
              </span>
              <span className="hstack">
                <span
                  className="dashboard__legend-swatch"
                  style={{ background: 'rgba(224,162,58,0.45)' }}
                />
                Stretched
              </span>
              <span className="hstack">
                <span
                  className="dashboard__legend-swatch"
                  style={{ background: 'rgba(229,72,77,0.5)' }}
                />
                Overloaded
              </span>
            </div>
          </div>
          <WorkloadHeatmap days={PLACEHOLDER_HEAT_DAYS} data={PLACEHOLDER_HEAT_DATA} />
        </div>

        {/* Recent activity */}
        <div className="card dashboard__col-4">
          <div className="dashboard__widget-title" style={{ marginBottom: 10 }}>
            Recent activity <span className="dashboard__sample">· sample</span>
          </div>
          <div className="vstack" style={{ gap: 10 }}>
            {PLACEHOLDER_ACTIVITY.map((a, i) => (
              <div key={i} className="hstack dashboard__activity">
                {a.ai ? (
                  <span className="dashboard__ai-mark">
                    <Icon name="sparkles" size={10} color="#fff" />
                  </span>
                ) : (
                  <Avatar name={a.who} color={a.color} size="xs" />
                )}
                <span className="dashboard__activity-text">
                  <span style={{ fontWeight: 500 }}>{a.who}</span>{' '}
                  <span className="muted">{a.action}</span>{' '}
                  <span className="mono" style={{ color: 'var(--accent-primary)' }}>
                    {a.target}
                  </span>
                </span>
                <span className="mono dim dashboard__activity-time">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
