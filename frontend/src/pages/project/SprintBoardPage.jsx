import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { sprintsApi } from '@/api/sprints.api';
import { boardApi } from '@/api/board.api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { useProjectHub } from '@/hooks/useProjectHub';
import './SprintBoardPage.css';

export function SprintBoardPage() {
  const { slug: orgSlug, projectSlug, sprintId } = useParams();
  const [project, setProject] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);

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
        await load(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load sprint board.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, load]);

  useProjectHub(project?.id, (name) => {
    if (name === 'board.changed' || name === 'sprint.changed') {
      load(project.id).catch(() => {});
    }
  });

  if (error) return <p className="sprint-board__placeholder">{error}</p>;
  if (!project || !board) return <p className="sprint-board__placeholder">Loading…</p>;

  const daysLeft = sprint ? Math.max(0, Math.ceil((new Date(sprint.endDate) - new Date()) / 86400000)) : null;
  const pct = sprint && sprint.totalPoints > 0
    ? Math.round((sprint.donePoints / sprint.totalPoints) * 100)
    : 0;

  return (
    <div className="sprint-board">
      <header className="sprint-board__header">
        <div>
          <h1 className="sprint-board__title">{sprint?.name ?? 'Sprint board'}</h1>
          {sprint?.goal && <p className="sprint-board__goal">{sprint.goal}</p>}
        </div>
        <div className="sprint-board__stats">
          <Badge tone={daysLeft <= 2 ? 'warning' : 'info'}>
            {daysLeft != null ? `${daysLeft} days left` : '—'}
          </Badge>
          {sprint && (
            <Badge tone="purple">
              {sprint.donePoints}/{sprint.totalPoints} pts ({pct}%)
            </Badge>
          )}
        </div>
      </header>

      {/* Burndown placeholder — real chart lands in Phase 2 (F2-26). */}
      <div className="sprint-board__burndown" aria-label={`Sprint progress ${pct}%`}>
        <div className="sprint-board__burndown-fill" style={{ width: `${pct}%` }} />
      </div>

      <KanbanBoard board={board} onChanged={() => load(project.id)} />
    </div>
  );
}
