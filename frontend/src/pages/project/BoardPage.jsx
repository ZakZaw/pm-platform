import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RefreshCw, X } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { boardApi } from '@/api/board.api';
import { workflowApi } from '@/api/workflow.api';
import { epicsApi } from '@/api/epics.api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LiveIndicator } from '@/components/kanban/LiveIndicator';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { useProjectHub } from '@/hooks/useProjectHub';
import { useOrgMembers } from '@/hooks/useOrgMembers';
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

export function BoardPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState(null);
  const [board, setBoard] = useState(null);
  const [statusConfigs, setStatusConfigs] = useState([]);
  const [epics, setEpics] = useState([]);
  const [swimlane, setSwimlane] = useState('');
  const [error, setError] = useState(null);
  const [openedTaskId, setOpenedTaskId] = useState(null);

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
        const [, configs, eps] = await Promise.all([
          load(p.id, swimlane),
          workflowApi.list(p.id),
          epicsApi.listForProject(p.id),
        ]);
        if (cancelled) return;
        setStatusConfigs(configs);
        setEpics(eps);
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

  if (error) return <p className="board-page__placeholder">{error}</p>;
  if (!project || !filteredBoard) return <p className="board-page__placeholder">Loading…</p>;

  const epicOptions = [
    { value: '', label: 'All epics' },
    ...epics.map((e) => ({ value: e.id, label: e.title })),
  ];

  const assigneeOptions = [
    { value: '', label: 'All assignees' },
    ...members.map((m) => ({ value: m.userId, label: m.fullName })),
  ];

  const anyFilter = Boolean(epicId || priority || assigneeId);

  return (
    <div className="board-page">
      <header className="board-page__header">
        <div>
          <h1 className="board-page__title">Board</h1>
          <p className="board-page__sub">
            Execute. Drag tasks across status columns; updates push to teammates live.
          </p>
        </div>
        <div className="board-page__head-actions">
          <LiveIndicator status={hubStatus} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(project.id, swimlane).catch(() => {})}
            aria-label="Refresh board"
            title="Refresh"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="board-page__filters">
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
            <X size={14} aria-hidden="true" /> Clear filters
          </Button>
        )}
      </div>

      <KanbanBoard
        board={filteredBoard}
        statusConfigs={statusConfigs}
        projectId={project.id}
        epics={epics}
        onChanged={() => load(project.id, swimlane)}
        onOpenTask={setOpenedTaskId}
      />

      <TaskDetailDrawer
        taskId={openedTaskId}
        projectId={project.id}
        onClose={() => setOpenedTaskId(null)}
        onChanged={() => load(project.id, swimlane)}
      />
    </div>
  );
}
