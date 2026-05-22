import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Repeat, Workflow as WorkflowIcon } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { operationsApi, describeRecurrence } from '@/api/operations.api';
import { WorkflowEditorModal } from '@/components/operations/WorkflowEditorModal';
import './RunbooksPage.css';

// Generic project's runbooks index. Lists every workflow in the project
// with its next-scheduled run and a colored status pip for last result.
// The materialiser runs server-side when this query fires, so just
// loading the page advances the schedule.
export function RunbooksPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [workflows, setWorkflows] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | workflowId

  async function refresh(projectId) {
    const data = await operationsApi.listWorkflows(projectId);
    setWorkflows(data);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load runbooks.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug]);

  if (error) return <div className="page"><p style={{ color: 'var(--status-danger)' }}>{error}</p></div>;
  if (!project || !workflows) {
    return (
      <div className="page runbooks-page" aria-busy="true">
        <header className="page-header"><h1 className="page-title">Runbooks</h1></header>
        <div className="vstack" style={{ gap: 12 }}>
          {[0, 1].map((i) => <Skeleton key={i} height={80} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page runbooks-page">
      <header className="page-header">
        <div className="hstack" style={{ gap: 12, alignItems: 'baseline' }}>
          <h1 className="page-title">Runbooks</h1>
          <span className="muted">· {workflows.length} workflow{workflows.length === 1 ? '' : 's'}</span>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus size={13} aria-hidden="true" /> New workflow
        </Button>
      </header>

      {workflows.length === 0 ? (
        <EmptyState
          icon={<WorkflowIcon size={20} aria-hidden="true" />}
          title="No runbooks yet"
          subtitle="A workflow is a recurring procedure with a checklist — monthly compliance review, weekly stand-up notes, daily on-call check."
        >
          <Button onClick={() => setEditing('new')}>Create your first workflow</Button>
        </EmptyState>
      ) : (
        <div className="runbooks-page__list">
          {workflows.map((w) => (
            <WorkflowRow
              key={w.id}
              workflow={w}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              onEdit={() => setEditing(w.id)}
            />
          ))}
        </div>
      )}

      {editing && (
        <WorkflowEditorModal
          projectId={project.id}
          workflowId={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh(project.id).catch(() => {});
            toast.show({ tone: 'success', message: 'Workflow saved.' });
          }}
        />
      )}
    </div>
  );
}

function WorkflowRow({ workflow, orgSlug, projectSlug, onEdit }) {
  const next = workflow.nextRunAt ? new Date(workflow.nextRunAt) : null;
  const last = workflow.lastCompletedAt ? new Date(workflow.lastCompletedAt) : null;

  return (
    <Card className="runbook-card">
      <div className="runbook-card__main">
        <div className="hstack" style={{ gap: 12, alignItems: 'baseline' }}>
          <h2 className="runbook-card__title">{workflow.name}</h2>
          <Badge tone="neutral">
            <Repeat size={11} aria-hidden="true" /> {describeRecurrence(workflow.recurrenceRule)}
          </Badge>
          {workflow.overdueRunCount > 0 && (
            <Badge tone="danger">{workflow.overdueRunCount} overdue</Badge>
          )}
        </div>
        {workflow.description && (
          <p className="runbook-card__desc">{workflow.description}</p>
        )}
        <div className="runbook-card__meta">
          <span>
            <strong>Next:</strong>{' '}
            {next
              ? next.toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })
              : '—'}
          </span>
          <span>
            <strong>Last completed:</strong>{' '}
            {last
              ? last.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : 'Never'}
          </span>
          <span>
            <strong>Checklist:</strong> {workflow.template.length} item{workflow.template.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="runbook-card__actions">
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        {workflow.nextRunAt && next && (
          <NextRunButton workflowId={workflow.id} orgSlug={orgSlug} projectSlug={projectSlug} />
        )}
      </div>
    </Card>
  );
}

function NextRunButton({ workflowId, orgSlug, projectSlug }) {
  // Resolve the next pending run id via the workflow detail endpoint
  // when the user clicks. Avoids loading run details upfront for every
  // workflow on the index page.
  const [resolving, setResolving] = useState(false);
  const toast = useToast();

  async function go() {
    setResolving(true);
    try {
      const detail = await operationsApi.getWorkflow(workflowId);
      const next = detail.runs.find((r) => r.status === 'Pending' || r.status === 'InProgress');
      if (!next) {
        toast.show({ tone: 'info', message: 'No upcoming runs scheduled.' });
        return;
      }
      // Navigate via window.location to keep this component dumb — the
      // page-level <Link> already imports react-router so this only fires
      // when there's actually a run to open.
      window.location.assign(`/${orgSlug}/projects/${projectSlug}/runs/${next.id}`);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not open run.' });
    } finally {
      setResolving(false);
    }
  }

  return (
    <Button size="sm" onClick={go} disabled={resolving}>
      {resolving ? 'Opening…' : 'Open next run'}
    </Button>
  );
}
