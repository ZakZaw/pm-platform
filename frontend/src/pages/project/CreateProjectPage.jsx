import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Briefcase, FileText, Sparkles } from 'lucide-react';
import { Button, Card, Input, useToast } from '@/components/ui';
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
    key: 'template',
    title: 'From template',
    description: 'Pick a starter template that matches the project type.',
    Icon: FileText,
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
    if (mode === 'template') {
      toast.show({
        tone: 'info',
        title: 'Templates coming soon',
        message: 'Template picker ships in a follow-up task.',
      });
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
    <div className="page page-narrow create-project">
      <h1 className="create-project__title">New project</h1>
      <p className="create-project__subtitle">
        Pick a project type, then how to start it. You can change the structure later.
      </p>

      <div className="create-project__section-eyebrow">Project type</div>
      <div
        className="create-project__types"
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
              <Icon className="type-card__icon" aria-hidden="true" size={18} />
              <div className="type-card__title">{t.label}</div>
              <div className="type-card__desc">{t.description}</div>
            </button>
          );
        })}
      </div>

      <div className="create-project__section-eyebrow">Starting point</div>
      <div className="create-project__modes" role="radiogroup" aria-label="Project mode">
        {MODES.map((m) => {
          const Icon = m.Icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={['mode-card', active ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setMode(m.key)}
            >
              <Icon className="mode-card__icon" aria-hidden="true" size={20} />
              <div className="mode-card__title">{m.title}</div>
              <div className="mode-card__desc">{m.description}</div>
            </button>
          );
        })}
      </div>

      <Card className="create-project__form-card">
        <form onSubmit={onSubmit} className="create-project__form">
          <Input
            label="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Customer portal v2"
            required
            autoComplete="off"
          />

          <Button type="submit" disabled={submitting || (mode !== 'ai' && name.trim().length < 2)}>
            {submitting ? 'Creating…' : mode === 'ai' ? 'Continue with AI' : 'Create project'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
