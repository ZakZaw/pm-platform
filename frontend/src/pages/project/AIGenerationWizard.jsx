import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Sparkles, Trash2 } from 'lucide-react';
import {
  AIChip,
  Badge,
  Button,
  Card,
  Input,
  Select,
  useToast,
} from '@/components/ui';
import { aiApi } from '@/api/ai.api';
import { useProjectStore } from '@/store/projectStore';
import './AIGenerationWizard.css';

const ENV_OPTIONS = [
  { value: 'Developer', label: 'Engineering' },
  { value: 'Support', label: 'Support' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Business', label: 'Business / Ops' },
];

const STEPS = ['describe', 'clarify', 'preview'];

export function AIGenerationWizard() {
  const { slug: orgSlug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const refreshOrg = useProjectStore((s) => s.refreshForOrg);

  const [step, setStep] = useState('describe');
  const [description, setDescription] = useState('');
  const [envType, setEnvType] = useState('Developer');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [preview, setPreview] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function startClarify() {
    setError(null);
    if (description.trim().length < 10) {
      setError('Describe the project in at least 10 characters.');
      return;
    }
    setLoading(true);
    try {
      const { questions: qs } = await aiApi.clarify({
        description: description.trim(),
        environmentType: envType,
      });
      setQuestions(qs ?? []);
      setStep('clarify');
    } catch (err) {
      setError(err.response?.data?.detail ?? 'AI service did not respond.');
    } finally {
      setLoading(false);
    }
  }

  async function generate(includeAnswers) {
    setError(null);
    setLoading(true);
    try {
      const data = await aiApi.generateProject(orgSlug, {
        description: description.trim(),
        environmentType: envType,
        clarifications: includeAnswers
          ? questions
              .map((q) => ({ question: q, answer: (answers[q] ?? '').trim() }))
              .filter((c) => c.answer.length > 0)
          : [],
      });
      setPreview(data);
      setProjectName(data.suggestedName);
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not generate. Try a different prompt.');
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    setPreview(null);
    await generate(false);
  }

  async function applyPreview() {
    if (!preview) return;
    setError(null);
    setLoading(true);
    try {
      const project = await aiApi.applyGeneratedProject(preview.requestId, {
        projectName: projectName.trim(),
        environmentType: preview.environmentType,
        epics: preview.epics,
      });
      await refreshOrg(orgSlug).catch(() => {});
      toast.show({ tone: 'success', message: 'Project created.' });
      navigate(`/${orgSlug}/projects/${project.slug}`);
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not create the project. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function updateEpic(epicIdx, patch) {
    setPreview((p) => ({
      ...p,
      epics: p.epics.map((e, i) => (i === epicIdx ? { ...e, ...patch } : e)),
    }));
  }
  function removeEpic(epicIdx) {
    setPreview((p) => ({
      ...p,
      epics: p.epics.filter((_, i) => i !== epicIdx),
    }));
  }
  function updateStory(epicIdx, storyIdx, patch) {
    setPreview((p) => ({
      ...p,
      epics: p.epics.map((e, i) =>
        i !== epicIdx
          ? e
          : {
              ...e,
              stories: e.stories.map((s, j) => (j === storyIdx ? { ...s, ...patch } : s)),
            },
      ),
    }));
  }
  function removeStory(epicIdx, storyIdx) {
    setPreview((p) => ({
      ...p,
      epics: p.epics.map((e, i) =>
        i !== epicIdx ? e : { ...e, stories: e.stories.filter((_, j) => j !== storyIdx) },
      ),
    }));
  }
  function removeTask(epicIdx, storyIdx, taskIdx) {
    setPreview((p) => ({
      ...p,
      epics: p.epics.map((e, i) =>
        i !== epicIdx
          ? e
          : {
              ...e,
              stories: e.stories.map((s, j) =>
                j !== storyIdx
                  ? s
                  : { ...s, tasks: s.tasks.filter((_, k) => k !== taskIdx) },
              ),
            },
      ),
    }));
  }

  return (
    <div className="ai-wizard">
      <header className="ai-wizard__header">
        <div className="ai-wizard__title-row">
          <Sparkles className="ai-wizard__title-icon" size={22} aria-hidden="true" />
          <h1 className="ai-wizard__title">AI project generator</h1>
          <AIChip label={preview?.provider ?? 'AI'} />
        </div>
        <p className="ai-wizard__subtitle">
          Describe the project in plain English. AI proposes epics, stories, and tasks; you edit
          before committing.
        </p>
        <ol className="ai-wizard__steps">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={[
                'ai-wizard__step',
                step === s ? 'is-active' : '',
                STEPS.indexOf(step) > i ? 'is-done' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="ai-wizard__step-num">{i + 1}</span>
              <span>{labelFor(s)}</span>
            </li>
          ))}
        </ol>
      </header>

      {error && <p className="ai-wizard__error">{error}</p>}

      {step === 'describe' && (
        <Card variant="ai" className="ai-wizard__card">
          <label className="ai-wizard__label" htmlFor="ai-desc">
            What are you building?
          </label>
          <textarea
            id="ai-desc"
            className="ai-wizard__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. A booking platform for music tutors — students can search by instrument, book lessons, and pay with cards. Tutors manage availability and payouts."
            rows={6}
          />
          <Select
            label="Environment"
            options={ENV_OPTIONS}
            value={envType}
            onChange={(e) => setEnvType(e.target.value)}
          />
          <div className="ai-wizard__actions">
            <Button variant="ghost" onClick={() => navigate(`/${orgSlug}/projects/new`)}>
              Back
            </Button>
            <Button
              variant="ai"
              disabled={loading || description.trim().length < 10}
              onClick={startClarify}
            >
              {loading ? 'Thinking…' : 'Continue'}
            </Button>
          </div>
        </Card>
      )}

      {step === 'clarify' && (
        <Card variant="ai" className="ai-wizard__card">
          <h2 className="ai-wizard__heading">A few clarifying questions</h2>
          {questions.length === 0 ? (
            <p className="ai-wizard__placeholder">AI had no follow-up questions.</p>
          ) : (
            <div className="ai-wizard__questions">
              {questions.map((q) => (
                <label key={q} className="ai-wizard__question">
                  <span>{q}</span>
                  <Input
                    value={answers[q] ?? ''}
                    onChange={(e) => setAnswers((cur) => ({ ...cur, [q]: e.target.value }))}
                    placeholder="Your answer (optional)"
                  />
                </label>
              ))}
            </div>
          )}
          <div className="ai-wizard__actions">
            <Button variant="ghost" onClick={() => setStep('describe')}>
              Back
            </Button>
            <Button variant="secondary" onClick={() => generate(false)} disabled={loading}>
              Skip — generate with assumptions
            </Button>
            <Button variant="ai" onClick={() => generate(true)} disabled={loading}>
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </Card>
      )}

      {step === 'preview' && preview && (
        <>
          <Card variant="ai" className="ai-wizard__card">
            <Input
              label="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              help={`Suggested by ${preview.provider} (${preview.model}). Edit anything below before confirming.`}
            />
          </Card>

          <div className="ai-wizard__preview">
            {preview.epics.map((epic, ei) => (
              <EpicEditor
                key={ei}
                epic={epic}
                onChange={(patch) => updateEpic(ei, patch)}
                onRemove={() => removeEpic(ei)}
                onChangeStory={(si, patch) => updateStory(ei, si, patch)}
                onRemoveStory={(si) => removeStory(ei, si)}
                onRemoveTask={(si, ti) => removeTask(ei, si, ti)}
              />
            ))}
            {preview.epics.length === 0 && (
              <p className="ai-wizard__placeholder">All epics removed. Regenerate to start over.</p>
            )}
          </div>

          <div className="ai-wizard__actions ai-wizard__actions--sticky">
            <Button variant="ghost" onClick={() => setStep('describe')}>
              Start over
            </Button>
            <Button variant="secondary" onClick={regenerate} disabled={loading}>
              {loading ? 'Regenerating…' : 'Regenerate'}
            </Button>
            <Button
              variant="ai"
              onClick={applyPreview}
              disabled={loading || preview.epics.length === 0 || projectName.trim().length < 2}
            >
              {loading ? 'Creating…' : 'Confirm & create project'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function labelFor(s) {
  if (s === 'describe') return 'Describe';
  if (s === 'clarify') return 'Clarify';
  return 'Review & confirm';
}

function EpicEditor({ epic, onChange, onRemove, onChangeStory, onRemoveStory, onRemoveTask }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="ai-wizard__epic">
      <header className="ai-wizard__epic-head">
        <button
          type="button"
          className="ai-wizard__collapse"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <Input
          value={epic.title}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-label="Epic title"
        />
        <Badge tone="purple">{epic.stories.length} stories</Badge>
        <button
          type="button"
          className="ai-wizard__remove"
          onClick={onRemove}
          aria-label="Remove epic"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </header>
      {open && (
        <div className="ai-wizard__epic-body">
          {epic.description && <p className="ai-wizard__epic-desc">{epic.description}</p>}
          {epic.stories.map((story, si) => (
            <StoryEditor
              key={si}
              story={story}
              onChange={(patch) => onChangeStory(si, patch)}
              onRemove={() => onRemoveStory(si)}
              onRemoveTask={(ti) => onRemoveTask(si, ti)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function StoryEditor({ story, onChange, onRemove, onRemoveTask }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ai-wizard__story">
      <div className="ai-wizard__story-head">
        <button
          type="button"
          className="ai-wizard__collapse"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Collapse story' : 'Expand story'}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Input
          value={story.title}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-label="Story title"
        />
        <Badge tone="info">{story.priority}</Badge>
        <Badge tone="purple">{story.storyPoints} pts</Badge>
        <button
          type="button"
          className="ai-wizard__remove"
          onClick={onRemove}
          aria-label="Remove story"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="ai-wizard__story-body">
          {story.description && <p className="ai-wizard__story-desc">{story.description}</p>}
          {story.acceptanceCriteria?.length > 0 && (
            <>
              <div className="ai-wizard__sublabel">Acceptance criteria</div>
              <ul className="ai-wizard__ac">
                {story.acceptanceCriteria.map((ac, i) => (
                  <li key={i}>{ac}</li>
                ))}
              </ul>
            </>
          )}
          {story.tasks?.length > 0 && (
            <>
              <div className="ai-wizard__sublabel">Tasks</div>
              <ul className="ai-wizard__tasks">
                {story.tasks.map((task, ti) => (
                  <li key={ti} className="ai-wizard__task">
                    <span className="ai-wizard__task-title">{task.title}</span>
                    {task.description && (
                      <span className="ai-wizard__task-desc">{task.description}</span>
                    )}
                    <button
                      type="button"
                      className="ai-wizard__remove"
                      onClick={() => onRemoveTask(ti)}
                      aria-label="Remove task"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
