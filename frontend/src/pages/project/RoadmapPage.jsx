import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Skeleton } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { adapterForType } from '@/components/roadmap/roadmapRegistry';
import { RoadmapView } from '@/components/roadmap/RoadmapView';
import { findProjectType } from '@/constants/projectTypes';
import './RoadmapPage.css';

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

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner roadmap-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {project?.name ? `${project.name} · ` : ''}Timeline
            </div>
            <h1 className="page-title">Roadmap</h1>
          </div>
          {meta && <Badge tone="neutral">{meta.label}</Badge>}
        </div>
      </div>

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
