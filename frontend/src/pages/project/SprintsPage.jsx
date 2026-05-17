import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, Input, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { sprintsApi } from '@/api/sprints.api';
import './SprintsPage.css';

const STATUS_TONE = { Planning: 'neutral', Active: 'info', Closed: 'success' };

export function SprintsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(addDays(today(), 14));
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async (projectId) => {
    const list = await sprintsApi.listForProject(projectId);
    setSprints(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load sprints.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, refresh]);

  async function createSprint(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await sprintsApi.create(project.id, {
        name: name.trim(),
        goal: goal.trim() || null,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        velocityTarget: null,
      });
      toast.show({ tone: 'success', message: 'Sprint created.' });
      setName('');
      setGoal('');
      await refresh(project.id);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not create sprint.' });
    } finally {
      setCreating(false);
    }
  }

  async function startSprint(sprint) {
    try {
      await sprintsApi.start(sprint.id);
      toast.show({ tone: 'success', message: `${sprint.name} started.` });
      await refresh(project.id);
    } catch (err) {
      toast.show({ tone: 'danger', title: 'Could not start sprint', message: err.response?.data?.detail ?? '' });
    }
  }

  async function closeSprint(sprint) {
    const move = window.confirm(`Close ${sprint.name}? Incomplete tasks will move back to the backlog.`);
    if (!move) return;
    try {
      await sprintsApi.close(sprint.id, { moveCarryoversToBacklog: true });
      toast.show({ tone: 'success', message: `${sprint.name} closed.` });
      await refresh(project.id);
    } catch (err) {
      toast.show({ tone: 'danger', title: 'Could not close sprint', message: err.response?.data?.detail ?? '' });
    }
  }

  if (error) return <p className="sprints-page__placeholder">{error}</p>;
  if (!project) return <p className="sprints-page__placeholder">Loading…</p>;

  return (
    <div className="sprints-page">
      <header className="sprints-page__header">
        <h1 className="sprints-page__title">Sprint planning</h1>
      </header>

      <Card className="sprints-page__create" title="New sprint">
        <form className="sprints-page__form" onSubmit={createSprint}>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Sprint 12"
          />
          <Input
            label="Goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What this sprint will deliver"
          />
          <Input
            label="Start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input
            label="End"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
          <div className="sprints-page__form-submit">
            <Button type="submit" disabled={creating || name.trim().length < 2}>
              {creating ? 'Creating…' : 'Create sprint'}
            </Button>
          </div>
        </form>
      </Card>

      {sprints.length === 0 ? (
        <p className="sprints-page__placeholder">No sprints yet.</p>
      ) : (
        <Card>
          <ul className="sprints-page__list">
            {sprints.map((s) => (
              <li key={s.id} className="sprints-page__row">
                <div className="sprints-page__cell sprints-page__cell-main">
                  <div className="sprints-page__name">{s.name}</div>
                  {s.goal && <div className="sprints-page__goal">{s.goal}</div>}
                </div>
                <div className="sprints-page__cell">
                  <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                </div>
                <div className="sprints-page__cell sprints-page__cell-meta">
                  {new Date(s.startDate).toLocaleDateString()} →{' '}
                  {new Date(s.endDate).toLocaleDateString()}
                </div>
                <div className="sprints-page__cell sprints-page__cell-meta">
                  {s.taskCount} tasks · {s.donePoints}/{s.totalPoints} pts
                </div>
                <div className="sprints-page__cell sprints-page__actions">
                  {s.status === 'Planning' && (
                    <Button size="sm" onClick={() => startSprint(s)}>Start</Button>
                  )}
                  {s.status === 'Active' && (
                    <>
                      <Link to={`/${orgSlug}/projects/${projectSlug}/sprints/${s.id}/board`}>
                        <Button size="sm" variant="secondary">Open board</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => closeSprint(s)}>Close</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
