import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Sparkles, Workflow as WorkflowIcon } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { operationsApi, describeRecurrence } from '@/api/operations.api';
import { WorkflowEditorModal } from '@/components/operations/WorkflowEditorModal';
import './RunbooksPage.css';

const STATUS_TONE = {
  Active: 'success',
  Paused: 'warning',
  Archived: 'neutral',
};

function fmtRel(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const days = Math.floor(abs / 86_400_000);
  if (days < 1) {
    const hours = Math.floor(abs / 3_600_000);
    return future ? `in ${hours}h` : `${hours}h ago`;
  }
  if (days < 14) return future ? `in ${days}d` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtAbs(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function RunbooksPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [workflows, setWorkflows] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

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

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!project || !workflows) {
    return (
      <div className="main-inner runbooks-page" aria-busy="true">
        <div className="page-head">
          <Skeleton width="30%" height={28} />
        </div>
        <Skeleton height={240} radius="lg" />
      </div>
    );
  }

  const overdueTotal = workflows.reduce((s, w) => s + (w.overdueRunCount ?? 0), 0);

  return (
    <div className="main-inner runbooks-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{project.name} · Runbooks</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>Workflows</h1>
            <p className="page-subtitle" style={{ marginTop: 6 }}>
              {workflows.length} workflow{workflows.length === 1 ? '' : 's'}
              {overdueTotal > 0 && <> · <span style={{ color: 'var(--danger)' }}>{overdueTotal} overdue</span></>}
            </p>
          </div>
          <div className="row gap-3">
            <Button variant="ai" size="sm" disabled title="Coming in Phase 2">
              <Sparkles size={13} aria-hidden="true" /> Author from template
            </Button>
            <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
              <Plus size={14} aria-hidden="true" /> New workflow
            </Button>
          </div>
        </div>
      </div>

      {workflows.length === 0 ? (
        <EmptyState
          icon={<WorkflowIcon size={20} aria-hidden="true" />}
          title="No runbooks yet"
          subtitle="A workflow is a recurring procedure with a checklist — monthly compliance review, weekly stand-up notes, daily on-call check."
        >
          <Button onClick={() => setEditing('new')}>Create your first workflow</Button>
        </EmptyState>
      ) : (
        <div className="card runbooks-card">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Workflow</th>
                <th style={{ width: 140 }}>Recurrence</th>
                <th style={{ width: 110 }}>Last run</th>
                <th style={{ width: 90 }}>Steps</th>
                <th style={{ width: 110 }}>Next</th>
                <th style={{ width: 120 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w, i) => {
                const overdue = (w.overdueRunCount ?? 0) > 0;
                return (
                  <tr key={w.id} onClick={() => setEditing(w.id)} style={{ cursor: 'pointer' }}>
                    <td className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>WF-{String(i + 1).padStart(2, '0')}</td>
                    <td>
                      <div className="col" style={{ gap: 2 }}>
                        <span style={{ fontWeight: 500 }}>{w.name}</span>
                        {w.description && (
                          <span className="muted truncate" style={{ fontSize: 'var(--fs-xs)', maxWidth: 360 }}>{w.description}</span>
                        )}
                      </div>
                    </td>
                    <td>{describeRecurrence(w.recurrenceRule)}</td>
                    <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{fmtRel(w.lastCompletedAt)}</td>
                    <td className="mono" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{w.template?.length ?? 0}</td>
                    <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{fmtAbs(w.nextRunAt)}</td>
                    <td>
                      {overdue ? (
                        <Badge tone="danger">{w.overdueRunCount} overdue</Badge>
                      ) : (
                        <Badge tone={STATUS_TONE[w.status] ?? 'success'}>{w.status ?? 'Active'}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
