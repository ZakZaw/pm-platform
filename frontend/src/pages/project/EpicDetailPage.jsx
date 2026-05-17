import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Avatar, Badge, Button, Card, useToast } from '@/components/ui';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { projectsApi } from '@/api/projects.api';
import { epicsApi } from '@/api/epics.api';
import { tasksApi } from '@/api/tasks.api';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import './EpicDetailPage.css';

const PRIORITY_TONE = {
  Urgent: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
};

const STATUS_TONE = {
  Planning: 'neutral',
  InProgress: 'info',
  Done: 'success',
  Archived: 'neutral',
};

export function EpicDetailPage() {
  const { slug: orgSlug, projectSlug, epicId } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [epic, setEpic] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [openedTaskId, setOpenedTaskId] = useState(null);

  const { members } = useOrgMembers(orgSlug);
  const memberById = useMemo(() => {
    const map = {};
    for (const m of members) map[m.userId] = m;
    return map;
  }, [members]);

  const refresh = useCallback(async (projectId) => {
    const [e, t] = await Promise.all([
      epicsApi.get(epicId),
      tasksApi.listForProject(projectId, { epic_id: epicId, include_done: true }),
    ]);
    setEpic(e);
    setTasks(t);
  }, [epicId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load epic.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, refresh]);

  if (error) return <p className="epic-detail__placeholder">{error}</p>;
  if (!epic || !project) return <p className="epic-detail__placeholder">Loading…</p>;

  const pct = epic.totalStoryPoints > 0
    ? Math.round((epic.doneStoryPoints / epic.totalStoryPoints) * 100)
    : 0;

  return (
    <div className="epic-detail">
      <Link
        to={`/${orgSlug}/projects/${projectSlug}/epics`}
        className="epic-detail__back"
      >
        <ChevronLeft size={14} aria-hidden="true" /> Epics
      </Link>

      <header className="epic-detail__header">
        <span
          className="epic-detail__color"
          style={{ background: epic.color || 'var(--accent-primary)' }}
        />
        <div className="epic-detail__head-text">
          <div className="epic-detail__head-row">
            <h1 className="epic-detail__title">{epic.title}</h1>
            <Badge tone={STATUS_TONE[epic.status] ?? 'neutral'}>{epic.status}</Badge>
            {epic.riskFlag && <Badge tone="danger">At risk</Badge>}
          </div>
          <div className="epic-detail__meta">
            <span>{epic.taskCount} {epic.taskCount === 1 ? 'task' : 'tasks'}</span>
            <span>·</span>
            <span>{epic.doneStoryPoints}/{epic.totalStoryPoints} pts</span>
            <span>·</span>
            <span>{pct}% complete</span>
          </div>
          <div className="epic-detail__bar" aria-label={`Progress ${pct}%`}>
            <div className="epic-detail__bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      {epic.description && (
        <Card className="epic-detail__section">
          <h2 className="epic-detail__heading">Description</h2>
          <p className="epic-detail__desc">{epic.description}</p>
        </Card>
      )}

      <Card className="epic-detail__section">
        <h2 className="epic-detail__heading">Tasks ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <p className="epic-detail__placeholder">No tasks in this epic yet.</p>
        ) : (
          <ul className="epic-detail__tasks">
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                assignee={t.assigneeId ? memberById[t.assigneeId] : null}
                onOpen={setOpenedTaskId}
              />
            ))}
          </ul>
        )}
      </Card>

      <TaskDetailDrawer
        taskId={openedTaskId}
        projectId={project.id}
        onClose={() => setOpenedTaskId(null)}
        onChanged={() => refresh(project.id).catch(() => {})}
      />
    </div>
  );
}

function TaskRow({ task, assignee, onOpen }) {
  return (
    <li
      className="epic-detail__task is-interactive"
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(task.id);
        }
      }}
    >
      <span className="epic-detail__task-title">{task.title}</span>
      <div className="epic-detail__task-meta">
        <Badge tone="neutral">{task.status}</Badge>
        <Badge tone={PRIORITY_TONE[task.priority] ?? 'neutral'}>{task.priority}</Badge>
        {task.storyPoints != null && <Badge tone="purple">{task.storyPoints} pts</Badge>}
        {assignee && (
          <Avatar src={assignee.avatarUrl} name={assignee.fullName} size="xs" />
        )}
      </div>
    </li>
  );
}
