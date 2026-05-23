import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Icon, Skeleton } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { adapterForType } from '@/components/roadmap/roadmapRegistry';
import { RoadmapView } from '@/components/roadmap/RoadmapView';
import { findProjectType } from '@/constants/projectTypes';
import './RoadmapPage.css';

// F1.5-08 — Roadmap page. No type branching here; the registry picks
// the right adapter for the project's type and the view renders whatever
// shape the adapter returns. Adding a new project type means adding a
// new adapter + registry entry — nothing in this file changes.
export function RoadmapPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const [project, setProject] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        const adapter = adapterForType(p.type);
        if (!adapter) {
          setData(null);
          return;
        }
        const result = await adapter(p.id);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load roadmap.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug]);

  const meta = project ? findProjectType(project.type) : null;

  if (error) return <p className="roadmap-page__error">{error}</p>;

  return (
    <div className="page roadmap-page">
      <header className="page-header">
        <div className="hstack" style={{ gap: 8 }}>
          <Icon name="calendar" size={14} />
          <div className="page-title">Roadmap</div>
          {meta && <Badge tone="neutral">{meta.label}</Badge>}
        </div>
      </header>

      <div className="roadmap-page__body">
        {!project ? (
          <Skeleton height={220} radius="md" />
        ) : (
          <RoadmapView data={data} loading={loading} />
        )}
      </div>
    </div>
  );
}
