import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Eye, Power, Sparkles, ShieldQuestion } from 'lucide-react';
import { Button, Card, Skeleton, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import './AISettingsPage.css';

const MODES = [
  {
    value: 'Off',
    label: 'Off',
    Icon: Power,
    tone: 'neutral',
    summary: 'AI is disabled for this project.',
    details: [
      'No AI suggestions, automations, or breakdowns run.',
      'The Estimate, Breakdown, and AI Inbox actions all return an error.',
      'Existing audit-log entries stay; nothing is deleted.',
    ],
  },
  {
    value: 'AskMeFirst',
    label: 'Ask me first',
    Icon: ShieldQuestion,
    tone: 'warning',
    summary: 'AI never writes without an explicit click-through.',
    details: [
      'Automations open a modal instead of silently applying.',
      'Best for projects where wrong AI decisions are expensive.',
    ],
  },
  {
    value: 'Suggest',
    label: 'Suggest',
    Icon: Eye,
    tone: 'info',
    summary: 'AI drafts suggestions; you review them in the AI Inbox.',
    details: [
      'Default mode. Sprint-health insights, task breakdowns, estimates.',
      'Nothing changes in the project until you accept a card.',
    ],
  },
  {
    value: 'Autopilot',
    label: 'Autopilot',
    Icon: Sparkles,
    tone: 'purple',
    summary: 'AI applies low-impact changes silently. High-impact still queues a card.',
    details: [
      'Every AI write is audit-logged with a 24-hour undo window.',
      'High-impact actions (sprint replan, milestone shifts) still wait for review.',
      'Best for teams that already trust the AI suggestions in this project.',
    ],
  },
];

export function AISettingsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (!cancelled) setProject(p);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load project.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug]);

  const canEdit = project?.myRole === 'PM';

  const setMode = useCallback(async (value) => {
    if (!project || project.aiControlMode === value || !canEdit || saving) return;
    const prev = project.aiControlMode;
    setSaving(true);
    setProject({ ...project, aiControlMode: value });
    try {
      const updated = await projectsApi.updateSettings(project.id, { aiControlMode: value });
      setProject(updated);
      toast.show({ tone: 'success', message: `AI mode set to ${value}.` });
    } catch (err) {
      setProject({ ...project, aiControlMode: prev });
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not change AI mode.',
      });
    } finally {
      setSaving(false);
    }
  }, [project, canEdit, saving, toast]);

  if (loading) {
    return (
      <div className="main-inner">
        <Skeleton height={120} />
      </div>
    );
  }
  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner ai-settings">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {project?.name ?? 'Project'} · Settings
            </div>
            <h1 className="page-title">AI control mode</h1>
            <p className="page-subtitle">
              How much autonomy the AI has on this project. Changes are
              audit-logged. {canEdit ? '' : 'Only a PM can change this.'}
            </p>
          </div>
        </div>
      </div>

      <div className="ai-settings__grid">
        {MODES.map((mode) => {
          const selected = project?.aiControlMode === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              className={`ai-settings__card ai-settings__card--${mode.tone} ${selected ? 'is-selected' : ''}`}
              onClick={() => setMode(mode.value)}
              disabled={!canEdit || saving}
              aria-pressed={selected}
            >
              <div className="ai-settings__head">
                <span className="ai-settings__icon" aria-hidden="true">
                  <mode.Icon size={16} />
                </span>
                <span className="ai-settings__label">{mode.label}</span>
                {selected && (
                  <span className="ai-settings__selected-pill">
                    <Check size={11} aria-hidden="true" /> Selected
                  </span>
                )}
              </div>
              <p className="ai-settings__summary">{mode.summary}</p>
              <ul className="ai-settings__details">
                {mode.details.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
