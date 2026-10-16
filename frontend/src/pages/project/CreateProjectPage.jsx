import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Briefcase, Sparkles } from 'lucide-react';
import { Button, Input, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { useProjectStore } from '@/store/projectStore';
import { PROJECT_TYPES, DEFAULT_PROJECT_TYPE_ID } from '@/constants/projectTypes';
import './CreateProjectPage.css';

const MODES = [
  {
    key: 'blank',
    title: 'Start blank',
    description: 'A fresh project with no structure. Add work items as you go.',
    Icon: Briefcase,
  },
  {
    key: 'ai',
    title: 'AI generate',
    description: 'Describe the project in plain English; AI proposes the plan.',
    Icon: Sparkles,
  },
];

export function CreateProjectPage() {
  const { slug: orgSlug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const refreshOrg = useProjectStore((s) => s.refreshForOrg);

  const [typeId, setTypeId] = useState(DEFAULT_PROJECT_TYPE_ID);
  const [mode, setMode] = useState('blank');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'ai') {
      navigate(`/${orgSlug}/projects/new/ai?type=${typeId}`);
      return;
    }
    setSubmitting(true);
    try {
      const project = await projectsApi.create(orgSlug, {
        name: name.trim(),
        type: typeId,
      });
      await refreshOrg(orgSlug).catch(() => {});
      navigate(`/${orgSlug}/projects/${project.slug}`);
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not create project',
        message: err.response?.data?.detail ?? 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="main-inner create-project">
      <header className="page-head">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">Projects</p>
            <h1 className="page-title">New project</h1>
            <p className="page-subtitle">
              Pick a project type, then how to start it. You can change the structure later.
            </p>
          </div>
        </div>
      </header>

      <h2 className="create-project-section-title">
        <span className="create-project-step" aria-hidden="true">1</span>
        Project type
      </h2>
      <div
        className="create-project-types"
        role="radiogroup"
        aria-label="Project type"
      >
        {PROJECT_TYPES.map((t) => {
          const Icon = t.icon;
          const active = typeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={['type-card', active ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setTypeId(t.id)}
            >
              <span className={`proj-icon proj-icon-${t.id.toLowerCase()}`} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="type-card-text">
                <span className="type-card-title">{t.label}</span>
                <span className="type-card-desc">{t.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <h2 className="create-project-section-title">
        <span className="create-project-step" aria-hidden="true">2</span>
        Starting point
      </h2>
      <div className="create-project-modes" role="radiogroup" aria-label="Project mode">
        {MODES.map((m) => {
          const Icon = m.Icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={['mode-card', `mode-card-${m.key}`, active ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setMode(m.key)}
            >
              <Icon className="mode-card-icon" aria-hidden="true" size={18} />
              <span className="mode-card-title">{m.title}</span>
              <span className="mode-card-desc">{m.description}</span>
            </button>
          );
        })}
      </div>

      <h2 className="create-project-section-title">
        <span className="create-project-step" aria-hidden="true">3</span>
        Name it
      </h2>
      <form onSubmit={onSubmit} className="card create-project-form">
        <Input
          aria-label="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name, e.g. Customer portal v2"
          required
          autoComplete="off"
        />

        <Button type="submit" disabled={submitting || (mode !== 'ai' && name.trim().length < 2)}>
          {submitting ? 'Creating…' : mode === 'ai' ? 'Continue with AI' : 'Create project'}
        </Button>
      </form>
    </div>
  );
}
