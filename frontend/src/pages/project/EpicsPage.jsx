import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layers, Sparkles } from 'lucide-react';
import { Button, Card, EmptyState, Skeleton, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { epicsApi } from '@/api/epics.api';
import { EpicCard } from '@/components/epics/EpicCard';
import { EpicForm } from '@/components/epics/EpicForm';
import { AIEpicWizardModal } from '@/components/ai/AIEpicWizardModal';
import './EpicsPage.css';

export function EpicsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [epics, setEpics] = useState([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = project ?? (await projectsApi.getBySlug(orgSlug, projectSlug));
        if (cancelled) return;
        setProject(p);
        const list = await epicsApi.listForProject(p.id, { includeArchived });
        if (cancelled) return;
        setEpics(list);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load epics.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, projectSlug, includeArchived, refreshKey]);

  if (error) return <p className="epics-page__placeholder">{error}</p>;
  if (!project) {
    return (
      <div className="page epics-page">
        <header className="epics-page__header">
          <h1 className="epics-page__title">Epics</h1>
        </header>
        <div className="epics-page__grid" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton width="60%" height={16} />
              <div style={{ height: 8 }} />
              <Skeleton rows={2} />
              <div style={{ height: 12 }} />
              <Skeleton width={120} height={10} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page epics-page">
      <header className="epics-page__header">
        <h1 className="epics-page__title">Epics</h1>
        <div className="epics-page__actions">
          <label className="epics-page__toggle">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            <span>Show archived</span>
          </label>
          <Button variant="ai" onClick={() => setAiOpen(true)}>
            <Sparkles size={13} aria-hidden="true" /> AI epic
          </Button>
          <Button onClick={() => setCreating(true)}>New epic</Button>
        </div>
      </header>

      {project && (
        <AIEpicWizardModal
          open={aiOpen}
          projectId={project.id}
          onClose={() => setAiOpen(false)}
          onCreated={() => {
            setAiOpen(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {creating && (
        <Card className="epics-page__form-card" title="New epic">
          <EpicForm
            onSubmit={async (body) => {
              await epicsApi.create(project.id, body);
              toast.show({ tone: 'success', message: 'Epic created.' });
              setCreating(false);
              setRefreshKey((k) => k + 1);
            }}
            onCancel={() => setCreating(false)}
            submitLabel="Create"
          />
        </Card>
      )}

      {epics.length === 0 ? (
        <EmptyState
          icon={<Layers size={22} />}
          title="No epics yet"
          subtitle="Group related tasks into epics to track progress and timing as one. AI can draft one from a description in seconds."
        >
          <Button variant="ai" onClick={() => setAiOpen(true)}>
            <Sparkles size={13} aria-hidden="true" /> Draft with AI
          </Button>
          <Button variant="secondary" onClick={() => setCreating(true)}>
            New epic
          </Button>
        </EmptyState>
      ) : (
        <div className="epics-page__grid">
          {epics.map((e) => (
            <EpicCard
              key={e.id}
              epic={e}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
