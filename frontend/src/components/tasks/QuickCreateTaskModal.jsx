import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssigneePicker, Button, Input, Select, useToast } from '@/components/ui';
import { useUiStore } from '@/store/uiStore';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import { usersApi } from '@/api/users.api';
import { tasksApi } from '@/api/tasks.api';
import { epicsApi } from '@/api/epics.api';
import { sprintsApi } from '@/api/sprints.api';
import './QuickCreateTaskModal.css';

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Urgent', label: 'Urgent' },
];

const PERSONAL_VALUE = '__personal__';

export function QuickCreateTaskModal() {
  const open = useUiStore((s) => s.quickCreateOpen);
  const close = useUiStore((s) => s.closeQuickCreate);
  const toast = useToast();
  const navigate = useNavigate();

  const orgs = useOrgStore((s) => s.orgs);
  const projectsByOrg = useProjectStore((s) => s.byOrg);
  const refreshProjectsForOrg = useProjectStore((s) => s.refreshForOrg);

  const [personalProject, setPersonalProject] = useState(null);
  const [projectId, setProjectId] = useState(PERSONAL_VALUE);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [storyPoints, setStoryPoints] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [epicId, setEpicId] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [assigneeId, setAssigneeId] = useState(null);
  const [reviewerId, setReviewerId] = useState(null);
  const [acceptance, setAcceptance] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Per-project related lists, loaded once a real (non-personal) project is
  // selected so the user can pick epic / sprint / assignee.
  const [epics, setEpics] = useState([]);
  const [sprints, setSprints] = useState([]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle('');
    setDescription('');
    setPriority('Medium');
    setStoryPoints('');
    setDueDate('');
    setEpicId('');
    setSprintId('');
    setAssigneeId(null);
    setReviewerId(null);
    setAcceptance('');
    usersApi
      .personalProject()
      .then((p) => setPersonalProject(p))
      .catch(() => {});
    for (const o of orgs) {
      if (!projectsByOrg[o.slug]) refreshProjectsForOrg(o.slug).catch(() => {});
    }
  }, [open, orgs, projectsByOrg, refreshProjectsForOrg]);

  const options = useMemo(() => {
    const opts = [];
    if (personalProject) {
      opts.push({
        value: PERSONAL_VALUE,
        label: 'Personal (private to you)',
        projectId: personalProject.id,
        orgSlug: null,
        isPersonal: true,
      });
    }
    for (const org of orgs) {
      const list = projectsByOrg[org.slug] ?? [];
      for (const p of list) {
        opts.push({
          value: p.id,
          label: `${org.name} · ${p.name}`,
          projectId: p.id,
          orgSlug: org.slug,
          isPersonal: false,
        });
      }
    }
    return opts;
  }, [personalProject, orgs, projectsByOrg]);

  const chosen = useMemo(
    () => options.find((o) => o.value === projectId) ?? null,
    [options, projectId],
  );

  const resolvedProjectId =
    projectId === PERSONAL_VALUE ? personalProject?.id : projectId;
  const isPersonal = chosen?.isPersonal ?? projectId === PERSONAL_VALUE;

  // Pull epics + sprints when a non-personal project is chosen.
  useEffect(() => {
    if (!resolvedProjectId || isPersonal) {
      setEpics([]);
      setSprints([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all([
      epicsApi.listForProject(resolvedProjectId).catch(() => []),
      sprintsApi.listForProject(resolvedProjectId).catch(() => []),
    ]).then(([eps, sps]) => {
      if (cancelled) return;
      setEpics(eps);
      setSprints(sps.filter((s) => s.status !== 'Closed'));
    });
    return () => {
      cancelled = true;
    };
  }, [resolvedProjectId, isPersonal]);

  // Reset cross-project picks when the project changes.
  useEffect(() => {
    setEpicId('');
    setSprintId('');
    setAssigneeId(null);
    setReviewerId(null);
  }, [resolvedProjectId]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!resolvedProjectId) {
      setError('Pick a project for this task.');
      return;
    }
    const t = title.trim();
    if (t.length < 2) {
      setError('Title must be at least 2 characters.');
      return;
    }

    let pts = null;
    if (storyPoints.trim() !== '') {
      const n = parseInt(storyPoints, 10);
      if (Number.isNaN(n) || n < 0 || n > 200) {
        setError('Points must be 0–200.');
        return;
      }
      pts = n;
    }

    const acItems = acceptance
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setBusy(true);
    try {
      await tasksApi.create(resolvedProjectId, {
        title: t,
        description: description.trim() || null,
        priority,
        storyPoints: pts,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00Z`).toISOString() : null,
        epicId: epicId || null,
        sprintId: isPersonal ? null : sprintId || null,
        assigneeId: isPersonal ? null : assigneeId || null,
        reviewerId: isPersonal ? null : reviewerId || null,
        acceptanceCriteria: acItems.length > 0 ? acItems : null,
      });
      toast.show({ tone: 'success', message: 'Task created.' });
      close();
      if (projectId === PERSONAL_VALUE) {
        navigate('/dashboard');
      } else if (chosen?.orgSlug) {
        const proj = (projectsByOrg[chosen.orgSlug] ?? []).find((p) => p.id === chosen.value);
        if (proj) navigate(`/${chosen.orgSlug}/projects/${proj.slug}/backlog`);
      }
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not create task.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="qct-backdrop" role="dialog" aria-modal="true" aria-label="Create task">
      <div className="qct-modal">
        <header className="qct-modal__head">
          <h2 className="qct-modal__title">New task</h2>
          <button
            type="button"
            className="qct-modal__close"
            onClick={close}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <form className="qct-modal__form" onSubmit={submit}>
          <Select
            label="Project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            options={options}
          />
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            maxLength={200}
            placeholder="What needs to happen?"
          />

          {!isPersonal && (
            <div className="qct-modal__grid-2">
              <Select
                label="Epic"
                value={epicId}
                onChange={(e) => setEpicId(e.target.value)}
                options={[
                  { value: '', label: '— No epic —' },
                  ...epics.map((e) => ({ value: e.id, label: e.title })),
                ]}
              />
              <Select
                label="Sprint"
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                options={[
                  { value: '', label: '— Backlog —' },
                  ...sprints.map((s) => ({
                    value: s.id,
                    label: `${s.name}${s.status === 'Active' ? ' · active' : ''}`,
                  })),
                ]}
              />
            </div>
          )}

          <div className="qct-modal__grid-3">
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={PRIORITY_OPTIONS}
            />
            <Input
              label="Points"
              type="number"
              min={0}
              max={200}
              value={storyPoints}
              onChange={(e) => setStoryPoints(e.target.value)}
              placeholder="—"
            />
            <Input
              label="Due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {!isPersonal && chosen?.orgSlug && (
            <div className="qct-modal__grid-2">
              <div>
                <label className="qct-modal__label">Assignee</label>
                <AssigneePicker
                  orgSlug={chosen.orgSlug}
                  value={assigneeId}
                  onChange={setAssigneeId}
                />
              </div>
              <div>
                <label className="qct-modal__label">Reviewer</label>
                <AssigneePicker
                  orgSlug={chosen.orgSlug}
                  value={reviewerId}
                  onChange={setReviewerId}
                />
              </div>
            </div>
          )}

          <label className="qct-modal__label" htmlFor="qct-desc">
            Description (optional)
          </label>
          <textarea
            id="qct-desc"
            className="qct-modal__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
          />

          <label className="qct-modal__label" htmlFor="qct-ac">
            Acceptance criteria (one per line)
          </label>
          <textarea
            id="qct-ac"
            className="qct-modal__textarea"
            value={acceptance}
            onChange={(e) => setAcceptance(e.target.value)}
            rows={3}
            placeholder={'e.g.\nThe button is visible on the dashboard\nClicking it logs the user out'}
          />

          {error && <p className="qct-modal__error">{error}</p>}
          <div className="qct-modal__actions">
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || title.trim().length < 2}>
              {busy ? 'Creating…' : 'Create task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
