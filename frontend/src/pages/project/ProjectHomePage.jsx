import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Briefcase, Calendar, KanbanSquare, Layers, ListTodo, Plus } from 'lucide-react';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { epicsApi } from '@/api/epics.api';
import { tasksApi } from '@/api/tasks.api';
import { sprintsApi } from '@/api/sprints.api';
import { EpicCard } from '@/components/epics/EpicCard';
import './ProjectHomePage.css';

export function ProjectHomePage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const [project, setProject] = useState(null);
  const [epics, setEpics] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        const [es, ts, sprint] = await Promise.all([
          epicsApi.listForProject(p.id),
          tasksApi.listForProject(p.id, { include_done: false }),
          sprintsApi.getActive(p.id).catch(() => null),
        ]);
        if (cancelled) return;
        setEpics(es);
        setRecentTasks(ts.slice(0, 5));
        setActiveSprint(sprint ?? null);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load project.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, projectSlug]);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!project) {
    return (
      <div className="main-inner project-home" aria-busy="true">
        <div className="page-head">
          <div className="page-title-row">
            <Skeleton width="40%" height={22} />
          </div>
        </div>
        <Card>
          <Skeleton rows={3} />
        </Card>
        <div style={{ height: 12 }} />
        <Card>
          <Skeleton rows={4} />
        </Card>
      </div>
    );
  }

  return (
    <div className="main-inner project-home">
      <div className="page-head">
        <div className="page-title-row">
          <div className="row gap-4 fill">
            <Briefcase className="project-home-icon" aria-hidden="true" />
            <div className="fill">
              <div className="eyebrow" style={{ marginBottom: 6 }}>Project home</div>
              <h1 className="page-title">{project.name}</h1>
              <div className="project-home-meta">
                <Badge tone="neutral">{project.type}</Badge>
                <Badge tone={project.status === 'Active' ? 'success' : 'neutral'}>
                  {project.status}
                </Badge>
                <span className="project-home-slug">/{project.slug}</span>
              </div>
            </div>
          </div>
          <div className="row gap-2">
            <Link to={`/${orgSlug}/projects/${projectSlug}/board`}>
              <Button variant="secondary" size="sm">
                <KanbanSquare size={14} aria-hidden="true" /> Open board
              </Button>
            </Link>
            <Link to={`/${orgSlug}/projects/${projectSlug}/backlog`}>
              <Button size="sm">
                <Plus size={14} aria-hidden="true" /> Plan backlog
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="project-home-grid">
        <Card className="project-home-sprint-card" title="Active sprint">
          {activeSprint ? (
            <>
              <div className="project-home-sprint-name">{activeSprint.name}</div>
              <div className="project-home-sprint-meta">
                <Calendar size={14} aria-hidden="true" />
                <span>
                  {fmt(activeSprint.startDate)} → {fmt(activeSprint.endDate)}
                </span>
              </div>
              <div className="project-home-sprint-actions">
                <Link to={`/${orgSlug}/projects/${projectSlug}/board`}>
                  <Button variant="ghost" size="sm">View board</Button>
                </Link>
                <Link to={`/${orgSlug}/projects/${projectSlug}/backlog`}>
                  <Button variant="ghost" size="sm">Plan</Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="muted">No active sprint right now.</p>
              <Link to={`/${orgSlug}/projects/${projectSlug}/sprints`}>
                <Button size="sm">Create a sprint</Button>
              </Link>
            </>
          )}
        </Card>

        <Card className="project-home-quick" title="Jump in">
          <div className="project-home-quick-list">
            <Link to={`/${orgSlug}/projects/${projectSlug}/epics`} className="project-home-quick-link">
              <Layers size={16} aria-hidden="true" />
              <span>Epics</span>
              <span className="project-home-quick-count">{epics.length}</span>
            </Link>
            <Link to={`/${orgSlug}/projects/${projectSlug}/backlog`} className="project-home-quick-link">
              <ListTodo size={16} aria-hidden="true" />
              <span>Backlog</span>
            </Link>
            <Link to={`/${orgSlug}/projects/${projectSlug}/board`} className="project-home-quick-link">
              <KanbanSquare size={16} aria-hidden="true" />
              <span>Board</span>
            </Link>
          </div>
        </Card>
      </div>

      <section className="project-home-section">
        <header className="project-home-section-header">
          <h2 className="project-home-section-title">
            <Layers size={16} aria-hidden="true" /> Epics
          </h2>
          <Link to={`/${orgSlug}/projects/${projectSlug}/epics`}>
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </header>

        {epics.length === 0 ? (
          <Card className="project-home-empty">
            <p>No epics yet. Group related work under an epic to track progress at a glance.</p>
            <Link to={`/${orgSlug}/projects/${projectSlug}/epics`}>
              <Button size="sm">Create your first epic</Button>
            </Link>
          </Card>
        ) : (
          <div className="project-home-epic-grid">
            {epics.slice(0, 3).map((e) => (
              <EpicCard key={e.id} epic={e} orgSlug={orgSlug} projectSlug={projectSlug} />
            ))}
          </div>
        )}
      </section>

      <section className="project-home-section">
        <header className="project-home-section-header">
          <h2 className="project-home-section-title">Recent tasks</h2>
        </header>
        {recentTasks.length === 0 ? (
          <p className="muted">No tasks yet.</p>
        ) : (
          <Card>
            <ul className="project-home-story-list">
              {recentTasks.map((t) => (
                <li key={t.id} className="project-home-story-link">
                  <span className="project-home-story-title">{t.title}</span>
                  <Badge tone="neutral">{t.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
