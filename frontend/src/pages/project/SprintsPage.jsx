import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Skeleton, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { sprintsApi } from '@/api/sprints.api';
import { useConfirm } from '@/hooks/useConfirm';
import './SprintsPage.css';

const STATUS_TONE = { Planning: 'neutral', Active: 'info', Closed: 'success' };

export function SprintsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
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
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        velocityTarget: null,
      });
      toast.show({ tone: 'success', message: 'Sprint created.' });
      setName('');
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
    const ok = await confirm({
      title: `Close ${sprint.name}?`,
      message: 'Incomplete tasks will move back to the backlog. Final velocity gets recorded.',
      confirmLabel: 'Close sprint',
      tone: 'warning',
    });
    if (!ok) return;
    try {
      await sprintsApi.close(sprint.id, { moveCarryoversToBacklog: true });
      toast.show({ tone: 'success', message: `${sprint.name} closed.` });
      await refresh(project.id);
    } catch (err) {
      toast.show({ tone: 'danger', title: 'Could not close sprint', message: err.response?.data?.detail ?? '' });
    }
  }

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!project) {
    return (
      <div className="main-inner sprints-page" aria-busy="true">
        <div className="page-head">
          <div className="page-title-row">
            <h1 className="page-title">Sprint planning</h1>
          </div>
        </div>
        <Card>
          <Skeleton rows={4} />
        </Card>
      </div>
    );
  }

  return (
    <div className="main-inner sprints-page">
      {dialog}
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{project.name}</div>
            <h1 className="page-title">Sprint planning</h1>
            <div className="page-subtitle">
              Time-box scope into sprints, then add work from the backlog. Sprints record velocity on close.
            </div>
          </div>
        </div>
      </div>

      <Card className="sprints-page-create" title="New sprint">
        <form className="sprints-page-form" onSubmit={createSprint}>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Sprint 12"
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
          <div className="sprints-page-form-submit">
            <Button type="submit" disabled={creating || name.trim().length < 2}>
              {creating ? 'Creating…' : 'Create sprint'}
            </Button>
          </div>
        </form>
      </Card>

      {sprints.length === 0 ? (
        <EmptyState
          icon={<Rocket size={22} />}
          title="No sprints yet"
          subtitle="Create your first sprint above. Sprints time-box scope; you can add tasks from the backlog once the sprint exists."
        />
      ) : (
        <Card>
          <ul className="sprints-page-list">
            {sprints.map((s) => {
              const detailHref = `/${orgSlug}/projects/${projectSlug}/sprints/${s.id}`;
              const open = () => navigate(detailHref);
              return (
                <li
                  key={s.id}
                  className="sprints-page-row is-interactive"
                  role="button"
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      open();
                    }
                  }}
                >
                  <div className="sprints-page-cell">
                    <div className="sprints-page-name">{s.name}</div>
                  </div>
                  <div className="sprints-page-cell">
                    <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                  </div>
                  <div className="sprints-page-cell sprints-page-cell-meta">
                    {new Date(s.startDate).toLocaleDateString()} →{' '}
                    {new Date(s.endDate).toLocaleDateString()}
                  </div>
                  <div className="sprints-page-cell sprints-page-cell-meta">
                    {s.taskCount} tasks · {s.donePoints}/{s.totalPoints} pts
                  </div>
                  <div
                    className="sprints-page-cell sprints-page-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {s.status === 'Planning' && (
                      <Button size="sm" onClick={() => startSprint(s)}>Start</Button>
                    )}
                    {s.status === 'Active' && (
                      <>
                        <Link to={`${detailHref}/board`}>
                          <Button size="sm" variant="secondary">Open board</Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => closeSprint(s)}>Close</Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
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
