import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Briefcase, Layers } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { epicsApi } from '@/api/epics.api';
import { storiesApi } from '@/api/stories.api';
import { EpicCard } from '@/components/epics/EpicCard';
import './ProjectHomePage.css';

export function ProjectHomePage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const [project, setProject] = useState(null);
  const [epics, setEpics] = useState([]);
  const [recentStories, setRecentStories] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        const [es, ss] = await Promise.all([
          epicsApi.listForProject(p.id),
          storiesApi.listForProject(p.id),
        ]);
        if (cancelled) return;
        setEpics(es);
        setRecentStories(ss.slice(0, 5));
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load project.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, projectSlug]);

  if (error) return <p className="project-home__placeholder">{error}</p>;
  if (!project) return <p className="project-home__placeholder">Loading…</p>;

  return (
    <div className="project-home">
      <div className="project-home__header">
        <Briefcase className="project-home__icon" aria-hidden="true" />
        <div>
          <div className="project-home__title">{project.name}</div>
          <div className="project-home__meta">
            <Badge tone="neutral">{project.environmentType}</Badge>
            <Badge tone={project.status === 'Active' ? 'success' : 'neutral'}>
              {project.status}
            </Badge>
            <span className="project-home__slug">/{project.slug}</span>
          </div>
        </div>
      </div>

      <section className="project-home__section">
        <header className="project-home__section-header">
          <h2 className="project-home__section-title">
            <Layers size={16} aria-hidden="true" /> Epics
          </h2>
          <Link to={`/${orgSlug}/projects/${projectSlug}/epics`}>
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </header>

        {epics.length === 0 ? (
          <Card className="project-home__empty">
            <p>No epics yet. Group related work under an epic to track progress at a glance.</p>
            <Link to={`/${orgSlug}/projects/${projectSlug}/epics`}>
              <Button size="sm">Create your first epic</Button>
            </Link>
          </Card>
        ) : (
          <div className="project-home__epic-grid">
            {epics.slice(0, 3).map((e) => (
              <EpicCard key={e.id} epic={e} orgSlug={orgSlug} projectSlug={projectSlug} />
            ))}
          </div>
        )}
      </section>

      <section className="project-home__section">
        <header className="project-home__section-header">
          <h2 className="project-home__section-title">Recent stories</h2>
        </header>
        {recentStories.length === 0 ? (
          <p className="project-home__placeholder">No stories yet.</p>
        ) : (
          <Card>
            <ul className="project-home__story-list">
              {recentStories.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/${orgSlug}/projects/${projectSlug}/stories/${s.id}`}
                    className="project-home__story-link"
                  >
                    <span className="project-home__story-title">{s.title}</span>
                    <Badge tone="neutral">{s.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
