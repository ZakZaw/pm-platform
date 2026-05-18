import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Briefcase, Plus } from 'lucide-react';
import { Avatar, Badge, Button, Card } from '@/components/ui';
import { orgsApi } from '@/api/orgs.api';
import { projectsApi } from '@/api/projects.api';
import './OrgHomePage.css';

export function OrgHomePage() {
  const { slug } = useParams();
  // key={slug} on the parent route resets these on slug change.
  const [org, setOrg] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [orgData, projectList] = await Promise.all([
          orgsApi.get(slug),
          projectsApi.listForOrg(slug),
        ]);
        if (cancelled) return;
        setOrg(orgData);
        setProjects(projectList);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail ?? 'Could not load organization.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) return <p className="org-home__placeholder">{error}</p>;
  if (!org) return <p className="org-home__placeholder">Loading…</p>;

  return (
    <div className="page org-home">
      <div className="org-home__header">
        <Avatar src={org.logoUrl} name={org.name} size="xl" />
        <div>
          <div className="org-home__title">{org.name}</div>
          <div className="org-home__slug">/{org.slug}</div>
        </div>
      </div>

      <section className="org-home__section">
        <header className="org-home__section-head">
          <h2 className="org-home__section-title">Projects</h2>
          <Link to={`/${slug}/projects/new`}>
            <Button size="sm"><Plus size={14} aria-hidden="true" /> New project</Button>
          </Link>
        </header>

        {projects.length === 0 ? (
          <Card className="org-home__empty">
            <Briefcase size={32} aria-hidden="true" />
            <p>No projects yet. Create your first one to start planning work.</p>
            <Link to={`/${slug}/projects/new`}>
              <Button>Create project</Button>
            </Link>
          </Card>
        ) : (
          <div className="org-home__project-grid">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/${slug}/projects/${p.slug}`}
                className="org-home__project-card"
              >
                <div className="org-home__project-name">{p.name}</div>
                <div className="org-home__project-meta">
                  <Badge tone="neutral">{p.environmentType}</Badge>
                  <Badge tone={p.status === 'Active' ? 'success' : 'neutral'}>{p.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
