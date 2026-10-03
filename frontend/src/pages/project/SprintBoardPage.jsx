import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { sprintsApi } from '@/api/sprints.api';
import { boardApi } from '@/api/board.api';
import { workflowApi } from '@/api/workflow.api';
import { epicsApi } from '@/api/epics.api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LiveIndicator } from '@/components/kanban/LiveIndicator';
import { ColumnsButton } from '@/components/kanban/ColumnsButton';
import { SprintMeta } from '@/components/kanban/SprintMeta';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { useProjectHub } from '@/hooks/useProjectHub';
import { useColumnVisibility } from '@/hooks/useColumnVisibility';
import './BoardPage.css';
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
  if (!project || !board) {
    return (
      <div className="main-inner board-page sprint-board" aria-busy="true">
        <div className="page-head">
          <Skeleton width="35%" height={20} />
        </div>
      </div>
    );
  }

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
    <div className="main-inner board-page sprint-board">
      <div className="page-head">
        <div className="page-title-row">
          <div className="board-page-heading">
            <div className="eyebrow">{project.name} · Sprint board</div>
            <h1 className="page-title board-page-title">
              {sprint?.name ?? 'Sprint'}
              {closed && <span className="status status-todo">Closed</span>}
              <LiveIndicator status={hubStatus} />
            </h1>
            {sprint?.goal && <p className="page-subtitle">{sprint.goal}</p>}
            <SprintMeta
              burnPoints={burnPoints}
              donePts={donePts}
              totalPts={totalPts}
              daysLeft={length != null && !closed ? daysLeft : null}
              range={range}
            />
          </div>
          <div className="board-page-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => load(project.id).catch(() => {})}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
            <ColumnsButton
              statuses={statusConfigs ?? []}
              isVisible={isStatusVisible}
              toggle={toggleStatus}
            />
          </div>
        </div>
        {totalPts > 0 && (
          <div
            className="bar sprint-board-progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Sprint progress ${pct}%`}
            title={`${pct}% of points done`}
          >
            {/* Width is data-driven, so it stays inline. */}
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

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
