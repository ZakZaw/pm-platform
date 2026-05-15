import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Briefcase, FileText, Sparkles } from 'lucide-react';
import { Button, Card, Input, Select, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { useProjectStore } from '@/store/projectStore';
import './CreateProjectPage.css';

const ENV_OPTIONS = [
  { value: 'Developer', label: 'Engineering' },
  { value: 'Support', label: 'Support' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Business', label: 'Business / Ops' },
];

const MODES = [
  {
    key: 'blank',
    title: 'Start blank',
    description: 'A fresh project with no structure. Add epics, stories, and tasks as you go.',
    Icon: Briefcase,
  },
  {
    key: 'template',
    title: 'From template',
    description: 'Pick a starter template that matches the work — engineering, support, etc.',
    Icon: FileText,
  },
  {
    key: 'ai',
    title: 'AI generate',
    description: 'Describe the project in plain English; AI proposes epics, stories, tasks.',
    Icon: Sparkles,
  },
];

export function CreateProjectPage() {
  const { slug: orgSlug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const refreshOrg = useProjectStore((s) => s.refreshForOrg);

  const [mode, setMode] = useState('blank');
  const [name, setName] = useState('');
  const [envType, setEnvType] = useState('Developer');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'ai') {
      navigate(`/${orgSlug}/projects/new/ai`);
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
        environmentType: envType,
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
    <div className="create-project">
      <h1 className="create-project__title">New project</h1>
      <p className="create-project__subtitle">
        Pick a starting point. You can change the structure later.
      </p>

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
          <Select
            label="Environment"
            options={ENV_OPTIONS}
            value={envType}
            onChange={(e) => setEnvType(e.target.value)}
            help="Used to pick the right integrations and templates."
          />

          <Button type="submit" disabled={submitting || name.trim().length < 2}>
            {submitting ? 'Creating…' : 'Create project'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
