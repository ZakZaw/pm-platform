import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
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

  // Sprint board has its own visibility scope so hiding a column on the
  // project board doesn't ghost it in the sprint view (and vice versa).
  const allStatuses = useMemo(
    () => (statusConfigs ?? []).map((c) => c.status),
    [statusConfigs],
  );
  const { visible: visibleStatuses, toggle: toggleStatus, isVisible: isStatusVisible } =
    useColumnVisibility(sprintId ? `sprint:${sprintId}` : null, allStatuses);

  if (error) return <p className="sprint-board__placeholder">{error}</p>;
  if (!project || !board) return <p className="sprint-board__placeholder">Loading…</p>;

  const daysLeft = sprint ? Math.max(0, Math.ceil((new Date(sprint.endDate) - new Date()) / 86400000)) : null;
  const pct = sprint && sprint.totalPoints > 0
    ? Math.round((sprint.donePoints / sprint.totalPoints) * 100)
    : 0;

  return (
    <div className="page sprint-board">
      <header className="sprint-board__header">
        <div>
          <h1 className="sprint-board__title">{sprint?.name ?? 'Sprint board'}</h1>
        </div>
        <div className="sprint-board__stats">
          <LiveIndicator status={hubStatus} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(project.id).catch(() => {})}
            aria-label="Refresh sprint board"
            title="Refresh"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </Button>
          <Badge tone={daysLeft <= 2 ? 'warning' : 'info'}>
            {daysLeft != null ? `${daysLeft} days left` : '—'}
          </Badge>
          {sprint && (
            <Badge tone="purple">
              {sprint.donePoints}/{sprint.totalPoints} pts ({pct}%)
            </Badge>
          )}
          <ColumnsButton
            statuses={statusConfigs ?? []}
            isVisible={isStatusVisible}
            toggle={toggleStatus}
          />
        </div>
      </header>

      {/* Burndown placeholder — real chart lands in Phase 2 (F2-26). */}
      <div className="sprint-board__burndown" aria-label={`Sprint progress ${pct}%`}>
        <div className="sprint-board__burndown-fill" style={{ width: `${pct}%` }} />
      </div>

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

      <TaskDetailDrawer
        taskId={openedTaskId}
        projectId={project.id}
        onClose={() => setOpenedTaskId(null)}
        onChanged={() => load(project.id)}
      />
    </div>
  );
}
