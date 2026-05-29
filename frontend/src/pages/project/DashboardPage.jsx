import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, RotateCcw, Settings2 } from 'lucide-react';
import {
  Badge,
  Button,
  Icon,
  Skeleton,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { boardApi } from '@/api/board.api';
import { sprintsApi } from '@/api/sprints.api';
import { dashboardApi } from '@/api/dashboard.api';
import { analyticsApi } from '@/api/analytics.api';
import { widgetsForType } from '@/components/dashboard/dashboardRegistry';
import { DashboardCanvas, defaultLayout } from '@/components/dashboard/DashboardCanvas';
import { ENGINEERING_WIDGETS } from '@/components/dashboard/engineeringWidgets';
import { useProjectRealtime } from '@/hooks/useProjectRealtime';
import { findProjectType } from '@/constants/projectTypes';
import './DashboardPage.css';

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

function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

// F1.5-08 dispatch shell — typed dashboards keep their static widget set
// for now; F2-04 customisation applies to the Engineering dashboard, which
// has the placeholder-heavy widgets users most want to tweak.
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
  const toast = useToast();
  const [board, setBoard] = useState(null);
  const [sprint, setSprint] = useState(null);
  // F2-26 — real analytics, recomputed server-side. Replaces the previously
  // client-derived / placeholder burndown, velocity and epic-progress.
  const [analytics, setAnalytics] = useState({ burndown: null, velocity: [], epicProgress: [] });
  const [layout, setLayout] = useState(() => defaultLayout(ENGINEERING_WIDGETS));
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState(null);
  // Bumps whenever realtime tells us a project event fired, so widgets that
  // own their own data (currently the activity feed) can re-fetch.
  const [activityVersion, setActivityVersion] = useState(0);

  const reloadData = useCallback(async () => {
    try {
      const [b, s, burndown, velocity, epicProgress] = await Promise.all([
        boardApi.get(project.id).catch(() => null),
        sprintsApi.getActive(project.id).catch(() => null),
        analyticsApi.burndown(project.id).catch(() => null),
        analyticsApi.velocity(project.id).then((r) => r.sprints ?? []).catch(() => []),
        analyticsApi.epicProgress(project.id).then((r) => r.epics ?? []).catch(() => []),
      ]);
      setBoard(b);
      setSprint(s);
      setAnalytics({ burndown, velocity, epicProgress });
      setActivityVersion((v) => v + 1);
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not load dashboard.');
    }
  }, [project.id]);

  useEffect(() => { reloadData(); }, [reloadData]);

  // Load saved layout once on mount; fall back to default. The version
  // suffix isolates layouts when the widget catalog changes incompatibly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await dashboardApi.getLayout(project.id);
        if (cancelled) return;
        if (r.layoutJson) {
          try {
            const parsed = JSON.parse(r.layoutJson);
            if (Array.isArray(parsed) && parsed.length > 0) setLayout(parsed);
          } catch {
            // Stored JSON was corrupt — fall back to default silently.
          }
        }
      } finally {
        if (!cancelled) setLayoutLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [project.id]);

  // Debounced save. We don't save layout changes while loading the
  // initial layout (would clobber server state with default).
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!layoutLoaded) return undefined;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      dashboardApi.saveLayout(project.id, layout).catch(() => {
        toast.show({ tone: 'danger', message: 'Could not save dashboard layout.' });
      });
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [layout, layoutLoaded, project.id, toast]);

  // Refresh on relevant project events. Burndown + epic-progress depend on
  // board state; velocity + sprint-meta depend on sprint state.
  useProjectRealtime(project.id, useMemo(() => ({
    'board.changed': () => reloadData(),
    'sprint.changed': () => reloadData(),
    'epic.dates_changed': () => reloadData(),
  }), [reloadData]));

  // Compute the shared ctx that every widget reads. Burndown / velocity /
  // epic-progress now come straight from the analytics endpoints; only the
  // board-derived KPI counters are computed client-side here.
  const ctx = useMemo(() => {
    const openTasks = (() => {
      if (!board) return 0;
      let n = 0;
      for (const lane of board.swimlanes) {
        for (const col of lane.columns) {
          if (col.status === 'Done' || col.status === 'WontDo') continue;
          n += col.cards.length;
        }
      }
      return n;
    })();
    const sprintTotal = sumPts(board, () => true);
    const sprintDone = sumPts(board, (col) => col.status === 'Done');
    const sprintLen = sprint ? daysBetween(sprint.startDate, sprint.endDate) : 0;
    const today = sprint
      ? Math.min(sprintLen, daysBetween(sprint.startDate, new Date().toISOString()))
      : 0;
    const daysLeft = Math.max(0, sprintLen - today);

    return {
      project, board, sprint,
      openTasks, sprintTotal, sprintDone, sprintLen, today, daysLeft,
      burndown: analytics.burndown,
      velocity: analytics.velocity,
      epicProgress: analytics.epicProgress,
      activityVersion,
    };
  }, [project, board, sprint, analytics, activityVersion]);

  const removeWidget = (id) => setLayout((l) => l.filter((it) => it.i !== id));

  const addWidget = (id) => {
    if (layout.some((it) => it.i === id)) return;
    const w = ENGINEERING_WIDGETS.find((x) => x.id === id);
    if (!w) return;
    // Append at the bottom of the canvas — react-grid-layout's compaction
    // will tidy gaps but a deterministic starting Y keeps the new widget
    // visible without users having to scroll up.
    const maxY = layout.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    setLayout((l) => [...l, { i: id, x: 0, y: maxY, w: w.defaults.w, h: w.defaults.h, minW: w.defaults.minW, minH: w.defaults.minH }]);
    setAddOpen(false);
  };

  const resetLayout = () => setLayout(defaultLayout(ENGINEERING_WIDGETS));

  const inLayout = new Set(layout.map((it) => it.i));
  const available = ENGINEERING_WIDGETS.filter((w) => !inLayout.has(w.id));

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
            <div className="dashboard__menu-wrap">
              <Button
                size="sm"
                onClick={() => setAddOpen((v) => !v)}
                disabled={available.length === 0}
                title={available.length === 0 ? 'All widgets are already on the canvas' : undefined}
              >
                <Plus size={13} aria-hidden="true" /> Add widget
              </Button>
              {addOpen && available.length > 0 && (
                <div className="menu dashboard__menu" role="menu">
                  <div className="menu-label">Available widgets</div>
                  {available.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className="menu-item"
                      onClick={() => addWidget(w.id)}
                    >
                      {w.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button size="sm" onClick={resetLayout} title="Reset to default layout">
              <RotateCcw size={13} aria-hidden="true" /> Reset
            </Button>
            <Button
              variant={editing ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setEditing((v) => !v)}
            >
              <Settings2 size={13} aria-hidden="true" />
              {editing ? 'Done editing' : 'Edit'}
            </Button>
          </div>
        </div>
      </div>

      <DashboardCanvas
        registry={ENGINEERING_WIDGETS}
        layout={layout}
        onLayoutChange={setLayout}
        editing={editing}
        onRemove={removeWidget}
        ctx={ctx}
      />
    </div>
  );
}
