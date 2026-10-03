import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MoreHorizontal, Plus, Sparkles, Workflow as WorkflowIcon } from 'lucide-react';
import {
  Button,
  Dropdown,
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { operationsApi, describeRecurrence } from '@/api/operations.api';
import { WorkflowEditorModal } from '@/components/operations/WorkflowEditorModal';
import './RunbooksPage.css';

// Workflow status read-out as dot + coloured text (stratos .status-*).
const STATUS_CLASS = {
  Active: 'status-done',
  Paused: 'status-review',
  Archived: 'status-todo',
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
            <h1 className="page-title">Runbooks</h1>
            <p className="page-subtitle">
              {workflows.length} workflow{workflows.length === 1 ? '' : 's'}
              {overdueTotal > 0 && <> · <span className="runbooks-overdue">{overdueTotal} overdue</span></>}
            </p>
          </div>
          <div className="row gap-3">
            <Dropdown
              align="end"
              trigger={(
                <button type="button" className="icon-btn" aria-label="More actions" title="More actions">
                  <MoreHorizontal size={16} aria-hidden="true" />
                </button>
              )}
            >
              <Dropdown.Item icon={<Sparkles size={13} aria-hidden="true" />} disabled>
                Author from template (coming in Phase 2)
              </Dropdown.Item>
            </Dropdown>
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
          <Button variant="secondary" onClick={() => setEditing('new')}>Create your first workflow</Button>
        </EmptyState>
      ) : (
        <div className="card runbooks-card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Workflow</th>
                <th className="runbooks-col-recur">Recurrence</th>
                <th className="runbooks-col-date">Last run</th>
                <th className="runbooks-col-date">Next</th>
                <th className="runbooks-col-steps">Steps</th>
                <th className="runbooks-col-status">Status</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => {
                const overdue = (w.overdueRunCount ?? 0) > 0;
                return (
                  <tr
                    key={w.id}
                    className="runbooks-row"
                    tabIndex={0}
                    onClick={() => setEditing(w.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setEditing(w.id);
                      }
                    }}
                  >
                    <td>
                      <div className="runbooks-name">{w.name}</div>
                      {w.description && (
                        <div className="runbooks-desc truncate">{w.description}</div>
                      )}
                    </td>
                    <td className="runbooks-secondary">{describeRecurrence(w.recurrenceRule)}</td>
                    <td className="muted">{fmtRel(w.lastCompletedAt)}</td>
                    <td className="muted">{fmtAbs(w.nextRunAt)}</td>
                    <td className="runbooks-col-steps">{w.template?.length ?? 0}</td>
                    <td>
                      {overdue ? (
                        <span className="status status-blocked">{w.overdueRunCount} overdue</span>
                      ) : (
                        <span className={`status ${STATUS_CLASS[w.status] ?? 'status-done'}`}>
                          {w.status ?? 'Active'}
                        </span>
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
