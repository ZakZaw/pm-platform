import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Zap } from 'lucide-react';
import { Badge, Button, Sparkline } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { sprintsApi } from '@/api/sprints.api';
import { boardApi } from '@/api/board.api';
import { workflowApi } from '@/api/workflow.api';
import { epicsApi } from '@/api/epics.api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LiveIndicator } from '@/components/kanban/LiveIndicator';
import { ColumnsButton } from '@/components/kanban/ColumnsButton';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { useProjectHub } from '@/hooks/useProjectHub';
import { useColumnVisibility } from '@/hooks/useColumnVisibility';
import './SprintBoardPage.css';

function fmtRange(start, end) {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  const opts = { month: 'short', day: '2-digit' };
  return `${s.toLocaleDateString(undefined, opts)} → ${e.toLocaleDateString(undefined, opts)}`;
}

function sprintLength(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export function SprintBoardPage() {
  const { slug: orgSlug, projectSlug, sprintId } = useParams();
  const [project, setProject] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [board, setBoard] = useState(null);
  const [statusConfigs, setStatusConfigs] = useState([]);
  const [epics, setEpics] = useState([]);
  const [error, setError] = useState(null);
  const [openedTaskId, setOpenedTaskId] = useState(null);

  const load = useCallback(async (projectId) => {
    const [sprints, b] = await Promise.all([
      sprintsApi.listForProject(projectId),
      boardApi.get(projectId, { sprintId }),
    ]);
    const s = sprints.find((x) => x.id === sprintId);
    setSprint(s ?? null);
    setBoard(b);
  }, [sprintId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        const [, configs, eps] = await Promise.all([
          load(p.id),
          workflowApi.list(p.id),
          epicsApi.listForProject(p.id),
        ]);
        if (cancelled) return;
        setStatusConfigs(configs);
        setEpics(eps);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load sprint board.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, load]);

  const { status: hubStatus } = useProjectHub(project?.id, (name) => {
    if (name === 'board.changed' || name === 'sprint.changed') {
      load(project.id).catch(() => {});
    }
  });

  const allStatuses = useMemo(
    () => (statusConfigs ?? []).map((c) => c.status),
    [statusConfigs],
  );
  const { visible: visibleStatuses, toggle: toggleStatus, isVisible: isStatusVisible } =
    useColumnVisibility(sprintId ? `sprint:${sprintId}` : null, allStatuses);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!project || !board) return <div className="main-inner"><p className="muted">Loading…</p></div>;

  const daysLeft = sprint
    ? Math.max(0, Math.ceil((new Date(sprint.endDate) - new Date()) / 86_400_000))
    : null;
  const length = sprintLength(sprint?.startDate, sprint?.endDate);
  const range = fmtRange(sprint?.startDate, sprint?.endDate);
  const totalPts = sprint?.totalPoints ?? 0;
  const donePts = sprint?.donePoints ?? 0;
  const remaining = Math.max(0, totalPts - donePts);
  const pct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;

  const burnPoints = length && totalPts > 0
    ? Array.from({ length: 8 }, (_, i) => {
        const ratio = i / 7;
        return totalPts - (totalPts - remaining) * ratio;
      })
    : null;

  const closed = sprint?.status === 'Closed';

  return (
    <div className="board-page sprint-board">
      <header className="board-page-head board-page-sprint">
        <div className="board-page-sprint-meta">
          <div className="row gap-3" style={{ marginBottom: 4 }}>
            <Badge tone={closed ? 'neutral' : 'info'}>
              <Zap size={11} aria-hidden="true" /> {sprint?.name ?? 'Sprint'}
            </Badge>
            {range && <span className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>{range}</span>}
            {closed && <Badge tone="neutral">Closed</Badge>}
            <LiveIndicator status={hubStatus} />
          </div>
          {sprint?.goal && (
            <div className="board-page-sprint-goal">
              <span className="muted">Goal · </span>
              {sprint.goal}
            </div>
          )}
        </div>

        {burnPoints && (
          <div className="board-page-kpi">
            <span className="eyebrow">Burndown</span>
            <Sparkline points={burnPoints} ideal />
          </div>
        )}

        {totalPts > 0 && (
          <div className="board-page-kpi board-page-kpi-bordered">
            <span className="eyebrow">Points</span>
            <span className="board-page-kpi-value">
              {donePts}
              <span className="muted board-page-kpi-suffix"> / {totalPts}</span>
            </span>
          </div>
        )}

        {length != null && !closed && (
          <div className="board-page-kpi board-page-kpi-bordered">
            <span className="eyebrow">Days left</span>
            <span
              className="board-page-kpi-value"
              style={{ color: daysLeft <= 3 ? 'var(--warning)' : undefined }}
            >
              {daysLeft}
              <span className="muted board-page-kpi-suffix"> of {length}</span>
            </span>
          </div>
        )}

        <div className="row gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => load(project.id).catch(() => {})}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </Button>
          <ColumnsButton
            statuses={statusConfigs ?? []}
            isVisible={isStatusVisible}
            toggle={toggleStatus}
          />
        </div>
      </header>

      {totalPts > 0 && (
        <div className="sprint-board-progress" aria-label={`Sprint progress ${pct}%`}>
          <div className="sprint-board-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="board-page-board">
        <KanbanBoard
          board={board}
          statusConfigs={statusConfigs}
          projectId={project.id}
          epics={epics}
          defaultSprintId={sprintId}
          visibleStatuses={visibleStatuses}
          onChanged={() => load(project.id)}
          onOpenTask={setOpenedTaskId}
        />
      </div>

      <TaskDetailDrawer
        taskId={openedTaskId}
        projectId={project.id}
        onClose={() => setOpenedTaskId(null)}
        onChanged={() => load(project.id)}
      />
    </div>
  );
}
