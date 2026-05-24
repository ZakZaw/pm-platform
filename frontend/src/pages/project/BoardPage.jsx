import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Filter, Plus, RefreshCw, X } from 'lucide-react';
import { Button, Select, Skeleton, Sparkline } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { boardApi } from '@/api/board.api';
import { workflowApi } from '@/api/workflow.api';
import { epicsApi } from '@/api/epics.api';
import { sprintsApi } from '@/api/sprints.api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LiveIndicator } from '@/components/kanban/LiveIndicator';
import { ColumnsButton } from '@/components/kanban/ColumnsButton';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { useProjectHub } from '@/hooks/useProjectHub';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useColumnVisibility } from '@/hooks/useColumnVisibility';
import { useUiStore } from '@/store/uiStore';
import './BoardPage.css';

const SWIMLANE_OPTIONS = [
  { value: '', label: 'No swimlanes' },
  { value: 'assignee', label: 'By assignee' },
  { value: 'epic', label: 'By epic' },
  { value: 'priority', label: 'By priority' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'Urgent', label: 'Urgent' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const ALL = '';

function fmtRange(start, end) {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  const opts = { month: 'short', day: '2-digit' };
  return `${s.toLocaleDateString(undefined, opts)} → ${e.toLocaleDateString(undefined, opts)}`;
}

function daysLeft(end) {
  if (!end) return null;
  const ms = new Date(end).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function sprintLength(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export function BoardPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState(null);
  const [board, setBoard] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [statusConfigs, setStatusConfigs] = useState([]);
  const [epics, setEpics] = useState([]);
  const [swimlane, setSwimlane] = useState('');
  const [error, setError] = useState(null);
  const [openedTaskId, setOpenedTaskId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const openQuickCreate = useUiStore((s) => s.openQuickCreate);

  const epicId = searchParams.get('epicId') ?? ALL;
  const priority = searchParams.get('priority') ?? ALL;
  const assigneeId = searchParams.get('assigneeId') ?? ALL;

  const { members } = useOrgMembers(orgSlug);

  const load = useCallback(async (projectId, lane) => {
    const data = await boardApi.get(projectId, { swimlaneBy: lane || undefined });
    setBoard(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        const [, configs, eps, activeSprint] = await Promise.all([
          load(p.id, swimlane),
          workflowApi.list(p.id),
          epicsApi.listForProject(p.id),
          sprintsApi.getActive(p.id).catch(() => null),
        ]);
        if (cancelled) return;
        setStatusConfigs(configs);
        setEpics(eps);
        setSprint(activeSprint);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load board.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, swimlane, load]);

  const { status: hubStatus } = useProjectHub(project?.id, (name) => {
    if (name === 'board.changed' || name === 'sprint.changed') {
      load(project.id, swimlane).catch(() => {});
    }
  });

  const allStatuses = useMemo(
    () => (statusConfigs ?? []).map((c) => c.status),
    [statusConfigs],
  );
  const { visible: visibleStatuses, toggle: toggleStatus, isVisible: isStatusVisible } =
    useColumnVisibility(project ? `board:${project.id}` : null, allStatuses);

  const filteredBoard = useMemo(() => {
    if (!board) return null;
    const matches = (card) => {
      if (epicId && card.epicId !== epicId) return false;
      if (priority && card.priority !== priority) return false;
      if (assigneeId && card.assigneeId !== assigneeId) return false;
      return true;
    };
    return {
      ...board,
      swimlanes: board.swimlanes.map((lane) => ({
        ...lane,
        columns: lane.columns.map((col) => ({
          ...col,
          cards: col.cards.filter(matches),
        })),
      })),
    };
  }, [board, epicId, priority, assigneeId]);

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }
  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    next.delete('epicId');
    next.delete('priority');
    next.delete('assigneeId');
    setSearchParams(next, { replace: true });
  }

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!project || !filteredBoard) {
    return (
      <div className="main-inner board-page" aria-busy="true">
        <div className="page-head">
          <Skeleton width="35%" height={20} />
        </div>
        <div className="board-page-board">
          <div className="kanban">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="kanban-col">
                <div className="kanban-col-head">
                  <Skeleton width="50%" height={14} />
                </div>
                <div className="kanban-col-body">
                  <Skeleton height={72} />
                  <Skeleton height={72} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const epicOptions = [
    { value: '', label: 'All epics' },
    ...epics.map((e) => ({ value: e.id, label: e.title })),
  ];
  const assigneeOptions = [
    { value: '', label: 'All assignees' },
    ...members.map((m) => ({ value: m.userId, label: m.fullName })),
  ];
  const anyFilter = Boolean(epicId || priority || assigneeId);

  // Sprint banner derivations
  const totalPts = sprint
    ? filteredBoard.swimlanes.reduce(
        (sum, lane) =>
          sum + lane.columns.reduce((s, col) => s + col.cards.reduce((c, card) => c + (card.storyPoints ?? 0), 0), 0),
        0,
      )
    : 0;
  const donePts = sprint
    ? filteredBoard.swimlanes.reduce(
        (sum, lane) =>
          sum + lane.columns
            .filter((c) => c.status === 'Done')
            .reduce((s, col) => s + col.cards.reduce((c, card) => c + (card.storyPoints ?? 0), 0), 0),
        0,
      )
    : 0;
  const remaining = Math.max(0, totalPts - donePts);
  const length = sprintLength(sprint?.startDate, sprint?.endDate);
  const left = daysLeft(sprint?.endDate);
  const range = fmtRange(sprint?.startDate, sprint?.endDate);

  // Burndown stays a two-point projection until daily snapshots land (F2-26).
  const burnPoints = length
    ? Array.from({ length: 8 }, (_, i) => {
        const ratio = i / 7;
        return totalPts - (totalPts - remaining) * ratio;
      })
    : null;

  return (
    <div className="main-inner board-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {project.name} · {sprint ? 'Sprint board' : 'Board'}
            </div>
            <h1 className="page-title row gap-3" style={{ fontSize: 'var(--fs-2xl)' }}>
              {sprint ? sprint.name : 'Board'}
              <LiveIndicator status={hubStatus} />
            </h1>
            {sprint?.goal && (
              <p className="page-subtitle" style={{ marginTop: 6 }}>
                <span className="muted">Goal · </span>{sprint.goal}
              </p>
            )}
            {!sprint && (
              <p className="page-subtitle" style={{ marginTop: 6 }}>
                No active sprint. Drag tasks across status columns; updates push to teammates live.
              </p>
            )}
          </div>
          <div className="row gap-4">
            {sprint && burnPoints && (
              <div className="board-page-banner">
                <div className="col" style={{ gap: 0 }}>
                  <div className="eyebrow board-page-banner-label">Burndown</div>
                  <div className="row gap-3" style={{ marginTop: 2 }}>
                    <Sparkline points={burnPoints} width={88} height={20} ideal />
                    {totalPts > 0 && (
                      <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                        {donePts}/{totalPts} pts
                      </span>
                    )}
                  </div>
                </div>
                {length && (
                  <>
                    <div className="divider-v" style={{ alignSelf: 'stretch' }} />
                    <div className="col center board-page-banner-days">
                      <div className="mono board-page-banner-days-num" style={{ color: left <= 3 ? 'var(--warning)' : undefined }}>
                        {left}d
                      </div>
                      <div className="muted board-page-banner-days-label">left</div>
                    </div>
                  </>
                )}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => load(project.id, swimlane).catch(() => {})} aria-label="Refresh" title="Refresh">
              <RefreshCw size={14} aria-hidden="true" />
            </Button>
            <Button size="sm" onClick={() => setFiltersOpen((v) => !v)}>
              <Filter size={14} aria-hidden="true" /> Filter
              {anyFilter && <span className="board-page-filter-dot" aria-hidden="true" />}
            </Button>
            <ColumnsButton
              statuses={statusConfigs ?? []}
              isVisible={isStatusVisible}
              toggle={toggleStatus}
            />
            <Button variant="primary" size="sm" onClick={() => openQuickCreate?.()}>
              <Plus size={14} aria-hidden="true" /> Add task
            </Button>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="board-page-filters">
          <Select
            label="Epic"
            options={epicOptions}
            value={epicId}
            onChange={(e) => setFilter('epicId', e.target.value)}
          />
          <Select
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(e) => setFilter('priority', e.target.value)}
          />
          <Select
            label="Assignee"
            options={assigneeOptions}
            value={assigneeId}
            onChange={(e) => setFilter('assigneeId', e.target.value)}
          />
          <Select
            label="Swimlanes"
            options={SWIMLANE_OPTIONS}
            value={swimlane}
            onChange={(e) => setSwimlane(e.target.value)}
          />
          {anyFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X size={14} aria-hidden="true" /> Clear
            </Button>
          )}
        </div>
      )}

      <div className="board-page-board">
        <KanbanBoard
          board={filteredBoard}
          statusConfigs={statusConfigs}
          projectId={project.id}
          epics={epics}
          visibleStatuses={visibleStatuses}
          onChanged={() => load(project.id, swimlane)}
          onOpenTask={setOpenedTaskId}
        />
      </div>

      <TaskDetailDrawer
        taskId={openedTaskId}
        projectId={project.id}
        onClose={() => setOpenedTaskId(null)}
        onChanged={() => load(project.id, swimlane)}
      />
    </div>
  );
}
