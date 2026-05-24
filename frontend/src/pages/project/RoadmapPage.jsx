import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Filter, Plus } from 'lucide-react';
import { Badge, Button, Segmented, Skeleton } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { adapterForType } from '@/components/roadmap/roadmapRegistry';
import { RoadmapView } from '@/components/roadmap/RoadmapView';
import { findProjectType } from '@/constants/projectTypes';
import './RoadmapPage.css';

const TYPE_TONE = {
  Engineering: 'accent',
  Sales: 'success',
  Support: 'rose',
  Marketing: 'warning',
  Operations: 'violet',
  Generic: 'neutral',
};

export function RoadmapPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const [project, setProject] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState('q');

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
  const tone = TYPE_TONE[meta?.id] ?? 'neutral';

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner roadmap-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {project?.name ?? '…'} · Timeline
            </div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>Roadmap</h1>
            {meta && (
              <p className="page-subtitle" style={{ marginTop: 6 }}>
                {meta.label} project · bars are color-coded by epic.
              </p>
            )}
          </div>
          <div className="row gap-3">
            {meta && <Badge tone={tone} dot>{meta.label}</Badge>}
            <Segmented
              value={scale}
              onChange={setScale}
              options={[
                { value: 'q', label: 'Quarter' },
                { value: 'm', label: 'Month', disabled: true },
                { value: 'y', label: 'Year', disabled: true },
              ]}
              ariaLabel="Timeline scale"
            />
            <Button size="sm" disabled title="Coming in Phase 2">
              <Filter size={13} aria-hidden="true" /> Filter
            </Button>
            <Button variant="primary" size="sm" disabled title="Coming in Phase 2">
              <Plus size={14} aria-hidden="true" /> Milestone
            </Button>
          </div>
        </div>
      </div>

      <div className="roadmap-page-body">
        {!project ? (
          <Skeleton height={220} radius="lg" />
        ) : (
          <RoadmapView data={data} loading={loading} />
        )}
      </div>
    </div>
  );
}
