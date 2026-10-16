import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Layers, Plus, Sparkles } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Priority,
  Segmented,
  Skeleton,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { epicsApi } from '@/api/epics.api';
import { tasksApi } from '@/api/tasks.api';
import { EpicForm } from '@/components/epics/EpicForm';
import { AIEpicWizardModal } from '@/components/ai/AIEpicWizardModal';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import './EpicsPage.css';

const STATUS_TONE = {
  NotStarted: 'neutral',
  InProgress: 'info',
  AtRisk: 'warning',
  Done: 'success',
  Archived: 'neutral',
  Planning: 'neutral',
};

const STATUS_LABEL = {
  NotStarted: 'Not started',
  Planning: 'Planning',
  InProgress: 'In progress',
  AtRisk: 'At risk',
  Done: 'Done',
  Archived: 'Archived',
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function EpicsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [epics, setEpics] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState({});
  const [openedTaskId, setOpenedTaskId] = useState(null);
  const [view, setView] = useState('list');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = project ?? (await projectsApi.getBySlug(orgSlug, projectSlug));
        if (cancelled) return;
        setProject(p);
        const [list, ts] = await Promise.all([
          epicsApi.listForProject(p.id, { includeArchived }),
          tasksApi.listForProject(p.id, { include_done: true }).catch(() => []),
        ]);
        if (cancelled) return;
        setEpics(list);
        setTasks(ts);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load epics.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, projectSlug, includeArchived, refreshKey]);

  // Group tasks by epic for the inline expand view.
  const tasksByEpic = useMemo(() => {
    const m = new Map();
    for (const t of tasks) {
      if (!t.epicId) continue;
      const arr = m.get(t.epicId) ?? [];
      arr.push(t);
      m.set(t.epicId, arr);
    }
    return m;
  }, [tasks]);

  const totalPoints = useMemo(() => tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0), [tasks]);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!project) {
    return (
      <div className="main-inner epics-page" aria-busy="true">
        <div className="page-head">
          <Skeleton width="30%" height={28} />
        </div>
        <div className="col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={86} radius="lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="main-inner epics-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow">{project.name}</div>
            <h1 className="page-title">Epics</h1>
            <p className="page-subtitle">
              {epics.length} epic{epics.length === 1 ? '' : 's'} · {tasks.length} task{tasks.length === 1 ? '' : 's'} · {totalPoints} points scoped
            </p>
          </div>
          <div className="row gap-3">
            <Button variant="secondary" size="sm" onClick={() => setAiOpen(true)}>
              <Sparkles size={14} aria-hidden="true" /> Decompose with AI
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} aria-hidden="true" /> New epic
            </Button>
          </div>
        </div>
      </div>

      <div className="row between epics-page-toolbar">
        <label className="row gap-3 muted epics-page-archived">
          <input
            type="checkbox"
            className="cb"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Show archived
        </label>
        <Segmented
          value={view}
          onChange={setView}
          size="sm"
          options={[
            { value: 'list', label: 'List' },
            { value: 'tree', label: 'Tree', disabled: true },
            { value: 'gantt', label: 'Timeline', disabled: true },
          ]}
          ariaLabel="Epics view"
        />
      </div>

      {creating && (
        <Card className="epics-page-form-card" title="New epic">
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

      {aiOpen && (
        <AIEpicWizardModal
          projectId={project.id}
          onClose={() => setAiOpen(false)}
          onCreated={() => {
            setAiOpen(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {epics.length === 0 ? (
        <EmptyState
          icon={<Layers size={22} />}
          title="No epics yet"
          subtitle="Group related tasks into epics to track progress and timing as one. AI can draft one from a description in seconds."
        >
          <Button variant="secondary" onClick={() => setAiOpen(true)}>
            <Sparkles size={14} aria-hidden="true" /> Draft with AI
          </Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            New epic
          </Button>
        </EmptyState>
      ) : (
        <div className="col epics-page-list">
          {epics.map((e) => {
            const epicTasks = tasksByEpic.get(e.id) ?? [];
            const done = epicTasks.filter((t) => t.status === 'Done').length;
            const inProg = epicTasks.filter((t) => t.status === 'InProgress' || t.status === 'InReview').length;
            const blocked = epicTasks.filter((t) => t.status === 'Blocked').length;
            const points = epicTasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
            const donePts = epicTasks.filter((t) => t.status === 'Done').reduce((s, t) => s + (t.storyPoints ?? 0), 0);
            const pct = points ? Math.round((donePts / points) * 100) : 0;
            const open = !!expanded[e.id];
            const status = e.status ?? 'NotStarted';

            return (
              <div key={e.id} className="card epics-page-card">
                <button
                  type="button"
                  className="epics-page-row"
                  onClick={() => setExpanded((cur) => ({ ...cur, [e.id]: !open }))}
                  aria-expanded={open}
                >
                  <div className="epics-page-icon" style={{ '--epic-color': e.color || 'var(--accent)' }}>
                    {(e.title ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="epics-page-title">
                    <h3 className="h-card">{e.title}</h3>
                    <div className="row gap-4 epics-page-sub">
                      <span className={`epics-page-status tone-${STATUS_TONE[status] ?? 'neutral'}`}>
                        {STATUS_LABEL[status] ?? status}
                      </span>
                      {e.description && (
                        <span className="muted truncate epics-page-desc">{e.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="col epics-page-progress">
                    <div className="row between">
                      <span className="epics-page-pct">{pct}%</span>
                      <span className="muted epics-page-pts">{donePts}/{points} pts</span>
                    </div>
                    <div className="bar"><div className={`bar-fill ${status === 'AtRisk' ? 'bar-fill-warning' : pct >= 80 ? 'bar-fill-success' : ''}`} style={{ width: `${pct}%` }} /></div>
                    <div className="row gap-4 epics-page-counts">
                      <span><span className="epics-page-count-done">{done}</span> done</span>
                      <span><span className="epics-page-count-active">{inProg}</span> active</span>
                      {blocked > 0 && <span><span className="epics-page-count-blocked">{blocked}</span> blocked</span>}
                    </div>
                  </div>
                  <div className="col epics-page-target">
                    <span className="muted epics-page-target-label">Target</span>
                    <span className="epics-page-target-date">{fmtDate(e.targetDate)}</span>
                  </div>
                  <div>
                    <Link to={`/${orgSlug}/projects/${projectSlug}/epics/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="epics-page-open">
                      Open
                    </Link>
                  </div>
                  <ChevronRight size={16} className={['epics-page-chev', open ? 'is-open' : ''].filter(Boolean).join(' ')} />
                </button>

                {open && (
                  <div className="epics-page-tasks">
                    {epicTasks.length === 0 ? (
                      <p className="muted epics-page-tasks-empty">
                        No tasks linked to this epic yet.
                      </p>
                    ) : (
                      <table className="tbl tbl-clean epics-page-table">
                        <thead>
                          <tr>
                            <th className="epics-page-col-key">Key</th>
                            <th>Task</th>
                            <th className="epics-page-col-status">Status</th>
                            <th className="epics-page-col-pri">Priority</th>
                            <th className="epics-page-col-pts">Pts</th>
                            <th className="epics-page-col-owner">Owner</th>
                          </tr>
                        </thead>
                        <tbody>
                          {epicTasks.map((t) => (
                            <tr
                              key={t.id}
                              className="epics-page-task-row"
                              onClick={() => setOpenedTaskId(t.id)}
                            >
                              <td className="mono muted epics-page-key">{t.key ?? '—'}</td>
                              <td className="epics-page-task-title">{t.title}</td>
                              <td><StatusBadge status={t.status} /></td>
                              <td><Priority level={t.priority} /></td>
                              <td className="epics-page-task-pts">{t.storyPoints ?? '—'}</td>
                              <td>{t.assigneeName ? <Avatar name={t.assigneeName} size="sm" /> : <span className="muted">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TaskDetailDrawer
        taskId={openedTaskId}
        projectId={project.id}
        onClose={() => setOpenedTaskId(null)}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
