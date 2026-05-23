import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Edit3,
  Layers,
  ListChecks,
  MessageSquareText,
  Plus,
  Quote,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
import { PROJECT_TYPES, DEFAULT_PROJECT_TYPE_ID, findProjectType } from '@/constants/projectTypes';
import { TypedGenerationPreview, typedDraftTotals } from '@/components/ai/TypedGenerationPreview';
import './AIGenerationWizard.css';

const TYPE_OPTIONS = PROJECT_TYPES.map((t) => ({ value: t.id, label: t.label }));

const STEPS = [
  { key: 'describe', label: 'Describe' },
  { key: 'clarify', label: 'Clarify' },
  { key: 'preview', label: 'Review & confirm' },
];

function stepState(step, current) {
  const ci = STEPS.findIndex((s) => s.key === current);
  const si = STEPS.findIndex((s) => s.key === step);
  if (si < ci) return 'done';
  if (si === ci) return 'active';
  return 'pending';
}

function StepDot({ n, label, state }) {
  const isDone = state === 'done';
  const isActive = state === 'active';
  return (
    <div className="hstack" style={{ gap: 8 }}>
      <div
        className={[
          'wizard-step',
          isActive ? 'is-active' : '',
          isDone ? 'is-done' : '',
        ].filter(Boolean).join(' ')}
      >
        {isDone ? <Check size={12} aria-hidden="true" /> : n}
      </div>
      <span className={['wizard-step-label', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}>
        {label}
      </span>
    </div>
  );
}

export function AIGenerationWizard() {
  const { slug: orgSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const refreshOrg = useProjectStore((s) => s.refreshForOrg);

  // The chooser on CreateProjectPage preselects the type via ?type=...
  // when the user arrives via "AI generate". Fall back to Engineering
  // when the wizard is opened directly.
  const initialType = (() => {
    const fromUrl = searchParams.get('type');
    return findProjectType(fromUrl)?.id ?? DEFAULT_PROJECT_TYPE_ID;
  })();

  const [step, setStep] = useState('describe');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState(initialType);
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
        type: projectType,
      });
      setQuestions(qs ?? []);
      setStep('clarify');
    } catch (err) {
      setError(describeAiError(err, 'AI service did not respond.'));
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
        type: projectType,
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
      setError(describeAiError(err, 'Could not generate. Try a different prompt.'));
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
      // F1.5-07 — Engineering keeps the editable-tree apply (sends the
      // wizard's edited epics back). Every other type sends just the
      // project name; the server already has the canonical draft.
      const isEngineeringApply = (preview.type ?? projectType) === 'Engineering';
      const project = isEngineeringApply
        ? await aiApi.applyGeneratedProject(preview.requestId, {
            projectName: projectName.trim(),
            type: preview.type ?? projectType,
            epics: preview.epics,
          })
        : await aiApi.applyTypedGeneratedProject(preview.requestId, projectName.trim());
      await refreshOrg(orgSlug).catch(() => {});
      toast.show({ tone: 'success', message: 'Project created.' });
      navigate(`/${orgSlug}/projects/${project.slug}`);
    } catch (err) {
      setError(describeAiError(err, 'Could not create the project. Please try again.'));
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
  function updateTask(epicIdx, taskIdx, patch) {
    setPreview((p) => ({
      ...p,
      epics: p.epics.map((e, i) =>
        i !== epicIdx
          ? e
          : {
              ...e,
              tasks: e.tasks.map((t, j) => (j === taskIdx ? { ...t, ...patch } : t)),
            },
      ),
    }));
  }
  function removeTask(epicIdx, taskIdx) {
    setPreview((p) => ({
      ...p,
      epics: p.epics.map((e, i) =>
        i !== epicIdx ? e : { ...e, tasks: e.tasks.filter((_, j) => j !== taskIdx) },
      ),
    }));
  }

  // Summary counts for the generated-plan header strip. Engineering keeps
  // its existing epics/tasks/points triplet; non-Engineering types report
  // a per-type string derived from the typed draft instead.
  const isTypedPreview = preview ? preview.type !== 'Engineering' : false;
  const totals = preview && !isTypedPreview
    ? preview.epics.reduce(
        (acc, e) => ({
          epics: acc.epics + 1,
          tasks: acc.tasks + e.tasks.length,
          points: acc.points + e.tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
        }),
        { epics: 0, tasks: 0, points: 0 },
      )
    : null;
  const typedTotalsLabel = isTypedPreview ? typedDraftTotals(preview) : null;

  return (
    <div className="ai-wizard">
      <div className="ai-wizard__inner">
        {/* Header */}
        <div className="ai-wizard__header">
          <div className="hstack" style={{ justifyContent: 'center', marginBottom: 14 }}>
            <AIChip label={preview?.provider ?? 'Plan with AI'} variant="soft" />
          </div>
          <h1 className="ai-wizard__title">
            {step === 'preview' ? 'Review your generated plan' : 'Plan a project with AI'}
          </h1>
          <p className="ai-wizard__subtitle">
            {step === 'preview'
              ? 'Edit any title, regenerate a node, or remove what you don’t want. Nothing is saved until you confirm.'
              : 'Describe the project in plain English. AI proposes epics and tasks; you edit before committing.'}
          </p>
        </div>

        {/* Stepper */}
        <div className="ai-wizard__stepper">
          {STEPS.map((s, i) => (
            <span key={s.key} className="hstack" style={{ gap: 24 }}>
              <StepDot n={i + 1} label={s.label} state={stepState(s.key, step)} />
              {i < STEPS.length - 1 && <span className="ai-wizard__step-connector" />}
            </span>
          ))}
        </div>

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
              label="Project type"
              options={TYPE_OPTIONS}
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              help="Shapes the AI plan — engineering gets epics+sprints, sales gets pipeline stages, etc."
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
            {/* Prompt recap */}
            <div className="card ai-wizard__prompt">
              <div className="hstack" style={{ gap: 6, marginBottom: 6 }}>
                <Quote size={12} color="var(--text-muted)" aria-hidden="true" />
                <span
                  className="muted"
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                  }}
                >
                  Your prompt
                </span>
                <span className="grow" />
                <Button variant="ghost" size="sm" onClick={() => setStep('describe')}>
                  <Edit3 size={11} aria-hidden="true" /> Edit
                </Button>
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                }}
              >
                “{description}”
              </div>
              {questions.length > 0 && (
                <div className="hstack" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {questions.map((q) => (
                    <Badge key={q} tone="purple">{q}</Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Project name */}
            <Card variant="ai" className="ai-wizard__card">
              <Input
                label="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                help={`Suggested by ${preview.provider} (${preview.model}). Edit anything below before confirming.`}
              />
            </Card>

            {/* Generated plan */}
            <div className="card-ai ai-wizard__plan">
              <div className="hstack ai-wizard__plan-head">
                <Sparkles size={14} color="var(--ai-violet)" aria-hidden="true" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {isTypedPreview ? `${preview.type} project` : 'Generated plan'}
                </span>
                {totals && (
                  <span className="mono dim" style={{ fontSize: 11 }}>
                    · {totals.epics} epics · {totals.tasks} tasks · {totals.points} points
                  </span>
                )}
                {isTypedPreview && typedTotalsLabel && (
                  <span className="mono dim" style={{ fontSize: 11 }}>· {typedTotalsLabel}</span>
                )}
                <span className="grow" />
                <span className="muted" style={{ fontSize: 11 }}>
                  Powered by {preview.provider}
                </span>
              </div>
              <div className="ai-wizard__plan-body">
                {isTypedPreview ? (
                  <TypedGenerationPreview preview={preview} />
                ) : (
                  <>
                    {preview.epics.map((epic, ei) => (
                      <EpicNode
                        key={ei}
                        epic={epic}
                        onChange={(patch) => updateEpic(ei, patch)}
                        onRemove={() => removeEpic(ei)}
                        onChangeTask={(ti, patch) => updateTask(ei, ti, patch)}
                        onRemoveTask={(ti) => removeTask(ei, ti)}
                      />
                    ))}
                    {preview.epics.length === 0 && (
                      <p className="ai-wizard__placeholder" style={{ padding: 16 }}>
                        All epics removed. Regenerate to start over.
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="hstack ai-wizard__plan-foot">
                <Button variant="ghost" size="md" onClick={regenerate} disabled={loading}>
                  <RefreshCw size={13} aria-hidden="true" /> Regenerate
                </Button>
                {!isTypedPreview && (
                  <Button variant="ghost" size="md" disabled>
                    <Plus size={13} aria-hidden="true" /> Add epic
                  </Button>
                )}
                <span className="grow" />
                <Button variant="secondary" size="md" disabled>
                  Save as draft
                </Button>
                <Button
                  variant="ai"
                  size="md"
                  onClick={applyPreview}
                  disabled={
                    loading
                    || (!isTypedPreview && preview.epics.length === 0)
                    || projectName.trim().length < 2
                  }
                >
                  <Check size={13} aria-hidden="true" />
                  {loading ? ' Creating…' : ' Confirm & create'}
                </Button>
              </div>
            </div>

            {/* Previous steps recap */}
            <div
              className="muted"
              style={{
                textAlign: 'center',
                marginTop: 24,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Previous steps
            </div>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <div className="card ai-wizard__recap">
                <div className="hstack" style={{ gap: 6, marginBottom: 8 }}>
                  <MessageSquareText size={12} aria-hidden="true" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Step 1 — Describe</span>
                  <Badge tone="success">
                    <Check size={11} aria-hidden="true" /> Done
                  </Badge>
                </div>
                <p className="ai-wizard__recap-text">
                  {description.length > 160 ? `${description.slice(0, 157)}…` : description}
                </p>
              </div>
              <div className="card ai-wizard__recap">
                <div className="hstack" style={{ gap: 6, marginBottom: 8 }}>
                  <ListChecks size={12} aria-hidden="true" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Step 2 — Clarify</span>
                  <Badge tone="success">
                    <Check size={11} aria-hidden="true" />
                    {' '}
                    {questions.filter((q) => (answers[q] ?? '').trim().length > 0).length} of {questions.length}
                  </Badge>
                </div>
                <ul className="ai-wizard__recap-list">
                  {questions.length === 0 && <li>· No clarifying questions</li>}
                  {questions.map((q) => (
                    <li key={q}>
                      · {q.length > 40 ? `${q.slice(0, 37)}…` : q} →{' '}
                      <span style={{ color: (answers[q] ?? '').trim() ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                        {(answers[q] ?? '').trim() || 'Skipped'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function describeAiError(err, fallback) {
  const detail = err?.response?.data?.detail;
  const title = err?.response?.data?.title;
  const status = err?.response?.status;
  if (status === 503 || title === 'AI.NotConfigured') {
    return 'AI is not configured on the server. Set GEMINI_API_KEY in the backend environment and restart the API.';
  }
  if (status === 502 || title === 'AI.ProviderFailed') {
    return 'The AI provider rejected the request. Check the backend logs and try again.';
  }
  if (status === 422 && title === 'AI.MissingAcceptanceCriteria') {
    return 'AI returned tasks without 2–5 acceptance criteria. Regenerate and try again.';
  }
  return detail ?? fallback;
}

function EpicNode({ epic, onChange, onRemove, onChangeTask, onRemoveTask }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <TreeRow
        kind="epic"
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={epic.title}
        onTitleChange={(v) => onChange({ title: v })}
        points={epic.tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0)}
        onRemove={onRemove}
        hasChildren
      />
      {open && (
        <div>
          {epic.tasks.map((task, ti) => (
            <TaskNode
              key={ti}
              task={task}
              depth={1}
              onChange={(patch) => onChangeTask(ti, patch)}
              onRemove={() => onRemoveTask(ti)}
            />
          ))}
          {epic.description && (
            <p className="ai-wizard__epic-desc" style={{ marginLeft: 36 }}>
              {epic.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TaskNode({ task, depth, onChange, onRemove }) {
  return (
    <TreeRow
      kind="task"
      depth={depth}
      title={task.title}
      onTitleChange={(v) => onChange({ title: v })}
      badges={[
        <Badge key="prio" tone="info">{task.priority}</Badge>,
      ]}
      points={task.storyPoints}
      onRemove={onRemove}
    />
  );
}

const KIND_STYLE = {
  epic:  { icon: Layers,      tone: 'purple',  label: 'EPIC' },
  task:  { icon: CheckSquare, tone: 'neutral', label: 'TASK' },
  story: { icon: BookOpen,    tone: 'info',    label: 'STORY' },
};

function TreeRow({
  kind,
  depth = 0,
  open,
  onToggle,
  hasChildren = false,
  title,
  onTitleChange,
  badges = [],
  points,
  onRemove,
}) {
  const { icon: Icon, tone, label } = KIND_STYLE[kind];
  const [editing, setEditing] = useState(false);
  return (
    <div
      className="ai-wizard__tree-row hstack"
      style={{ marginLeft: depth * 18 }}
    >
      {hasChildren ? (
        <button
          type="button"
          className="ai-wizard__chevron"
          onClick={onToggle}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      ) : (
        <span style={{ width: 12, flexShrink: 0 }} />
      )}
      <Badge tone={tone}>
        <Icon size={11} aria-hidden="true" /> {label}
      </Badge>
      {editing ? (
        <input
          className="input ai-wizard__tree-input grow"
          value={title}
          autoFocus
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span
          className="grow ai-wizard__tree-title"
          style={{ fontWeight: kind === 'epic' ? 500 : 400 }}
        >
          {title}
        </span>
      )}
      {badges.map((b, i) => (
        <span key={i}>{b}</span>
      ))}
      {points != null && (
        <span className="mono dim ai-wizard__tree-pts">{points}pt</span>
      )}
      <button
        type="button"
        className="icon-btn icon-btn-sm"
        onClick={() => setEditing((v) => !v)}
        aria-label="Edit"
        title="Edit"
      >
        <Edit3 size={11} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-btn icon-btn-sm"
        onClick={onRemove}
        aria-label="Remove"
        title="Remove"
      >
        <Trash2 size={11} aria-hidden="true" />
      </button>
    </div>
  );
}
