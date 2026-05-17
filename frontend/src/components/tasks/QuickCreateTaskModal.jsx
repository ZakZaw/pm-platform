import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, useToast } from '@/components/ui';
import { useUiStore } from '@/store/uiStore';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import { usersApi } from '@/api/users.api';
import { tasksApi } from '@/api/tasks.api';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle('');
    setDescription('');
    setPriority('Medium');
    // Lazy-load the personal project + every org's project list so the
    // picker is populated by the time the user opens the dropdown.
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
      });
    }
    for (const org of orgs) {
      const list = projectsByOrg[org.slug] ?? [];
      for (const p of list) {
        opts.push({
          value: p.id,
          label: `${org.name} · ${p.name}`,
          projectId: p.id,
        });
      }
    }
    return opts;
  }, [personalProject, orgs, projectsByOrg]);

  if (!open) return null;

  const resolvedProjectId =
    projectId === PERSONAL_VALUE ? personalProject?.id : projectId;

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
    setBusy(true);
    try {
      await tasksApi.create(resolvedProjectId, {
        title: t,
        description: description.trim() || null,
        priority,
      });
      toast.show({ tone: 'success', message: 'Task created.' });
      close();
      // If the user picked an org project, jump to its board so the new
      // task is visible immediately. Personal tasks land on My Work.
      if (projectId === PERSONAL_VALUE) {
        navigate('/dashboard');
      } else {
        const chosen = options.find((o) => o.value === projectId);
        if (chosen) {
          for (const org of orgs) {
            const p = (projectsByOrg[org.slug] ?? []).find((x) => x.id === chosen.value);
            if (p) {
              navigate(`/${org.slug}/projects/${p.slug}/backlog`);
              break;
            }
          }
        }
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
          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            options={PRIORITY_OPTIONS}
          />
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
