import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Select } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { boardApi } from '@/api/board.api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { useProjectHub } from '@/hooks/useProjectHub';
import './BoardPage.css';

const SWIMLANE_OPTIONS = [
  { value: '', label: 'No swimlanes' },
  { value: 'assignee', label: 'By assignee' },
  { value: 'epic', label: 'By epic' },
  { value: 'priority', label: 'By priority' },
];

export function BoardPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const [project, setProject] = useState(null);
  const [board, setBoard] = useState(null);
  const [swimlane, setSwimlane] = useState('');
  const [error, setError] = useState(null);

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
        await load(p.id, swimlane);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load board.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, swimlane, load]);

  // Live updates: when anyone in the project moves a card or changes
  // a sprint, re-fetch the board.
  useProjectHub(project?.id, (name) => {
    if (name === 'board.changed' || name === 'sprint.changed') {
      load(project.id, swimlane).catch(() => {});
    }
  });

  if (error) return <p className="board-page__placeholder">{error}</p>;
  if (!project || !board) return <p className="board-page__placeholder">Loading…</p>;

  return (
    <div className="board-page">
      <header className="board-page__header">
        <div>
          <h1 className="board-page__title">{project.name}</h1>
          <p className="board-page__sub">Board · all stories not in backlog</p>
        </div>
        <Select
          label="Swimlanes"
          options={SWIMLANE_OPTIONS}
          value={swimlane}
          onChange={(e) => setSwimlane(e.target.value)}
        />
      </header>

      <KanbanBoard board={board} onChanged={() => load(project.id, swimlane)} />
    </div>
  );
}
