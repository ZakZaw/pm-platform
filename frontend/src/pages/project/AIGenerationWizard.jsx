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
    <div className="row ai-wizard-stepdot">
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

  const answeredCount = questions.filter((q) => (answers[q] ?? '').trim().length > 0).length;

  return (
    <div className="ai-wizard">
      <div className="ai-wizard-inner">
        {/* Header */}
        <div className="ai-wizard-header">
          <div className="ai-mark ai-wizard-mark"><Sparkles size={16} /></div>
          <h1 className="ai-wizard-title">
            {step === 'preview' ? 'Review your generated plan' : 'New project with AI'}
          </h1>
          <p className="ai-wizard-subtitle">
            {step === 'preview'
              ? 'Edit any title, regenerate a node, or remove what you don’t want. Nothing is saved until you confirm.'
              : 'Describe it once · AI picks the type · scaffolds the work.'}
          </p>
        </div>

        {/* Stepper */}
        <div className="ai-wizard-stepper">
          {STEPS.map((s, i) => (
            <span key={s.key} className="row ai-wizard-stepper-item">
              <StepDot n={i + 1} label={s.label} state={stepState(s.key, step)} />
              {i < STEPS.length - 1 && <span className="ai-wizard-step-connector" />}
            </span>
          ))}
        </div>

        {error && <p className="ai-wizard-error">{error}</p>}

        {step === 'describe' && (
          <Card className="ai-wizard-card">
            <label className="ai-wizard-label" htmlFor="ai-desc">
              What are you building?
            </label>
            <textarea
              id="ai-desc"
              className="ai-wizard-textarea"
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
            <div className="ai-wizard-actions">
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
          <Card className="ai-wizard-card">
            <h2 className="ai-wizard-heading">A few clarifying questions</h2>
            {questions.length === 0 ? (
              <p className="ai-wizard-placeholder">AI had no follow-up questions.</p>
            ) : (
              <div className="ai-wizard-questions">
                {questions.map((q) => (
                  <label key={q} className="ai-wizard-question">
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
            <div className="ai-wizard-actions">
              <Button variant="ghost" onClick={() => setStep('describe')}>
                Back
              </Button>
              <Button variant="ghost" onClick={() => generate(false)} disabled={loading}>
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
            {/* Prompt recap + project name in one calm card */}
            <div className="card ai-wizard-card">
              <div className="ai-wizard-prompt">
                <div className="row ai-wizard-prompt-head">
                  <Quote size={14} aria-hidden="true" />
                  <span>Your prompt</span>
                  <span className="fill" />
                  <Button variant="ghost" size="sm" onClick={() => setStep('describe')}>
                    <Edit3 size={12} aria-hidden="true" /> Edit
                  </Button>
                </div>
                <p className="ai-wizard-prompt-text">“{description}”</p>
                {questions.length > 0 && (
                  <ul className="ai-wizard-prompt-questions">
                    {questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                )}
              </div>

              <Input
                label="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                help={`Suggested by ${preview.provider} (${preview.model}). Edit anything below before confirming.`}
              />
            </div>

            {/* Generated plan */}
            <div className="card ai-wizard-plan">
              <div className="row ai-wizard-plan-head">
                <span className="ai-wizard-plan-icon" aria-hidden="true">
                  <Sparkles size={14} />
                </span>
                <span className="ai-wizard-plan-title">
                  {isTypedPreview ? `${preview.type} project` : 'Generated plan'}
                </span>
                {totals && (
                  <span className="ai-wizard-plan-totals">
                    · {totals.epics} epics · {totals.tasks} tasks · {totals.points} points
                  </span>
                )}
                {isTypedPreview && typedTotalsLabel && (
                  <span className="ai-wizard-plan-totals">· {typedTotalsLabel}</span>
                )}
                <span className="fill" />
                <span className="ai-wizard-plan-provider">
                  Powered by {preview.provider}
                </span>
              </div>
              <div className="ai-wizard-plan-body">
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
                      <p className="ai-wizard-placeholder ai-wizard-placeholder-pad">
                        All epics removed. Regenerate to start over.
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="row ai-wizard-plan-foot">
                <Button variant="ghost" size="md" onClick={regenerate} disabled={loading}>
                  <RefreshCw size={14} aria-hidden="true" /> Regenerate
                </Button>
                {!isTypedPreview && (
                  <Button variant="ghost" size="md" disabled>
                    <Plus size={14} aria-hidden="true" /> Add epic
                  </Button>
                )}
                <span className="fill" />
                <Button variant="ghost" size="md" disabled>
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
                  <Check size={14} aria-hidden="true" />
                  {loading ? ' Creating…' : ' Confirm & create'}
                </Button>
              </div>
            </div>

            {/* Previous steps recap, collapsed by default */}
            <details className="ai-wizard-recap">
              <summary>Previous steps</summary>
              <div className="grid-2 ai-wizard-recap-grid">
                <div className="ai-wizard-recap-item">
                  <div className="row ai-wizard-recap-head">
                    <MessageSquareText size={14} aria-hidden="true" />
                    <span>Step 1 — Describe</span>
                    <span className="ai-wizard-recap-done">Done</span>
                  </div>
                  <p className="ai-wizard-recap-text">
                    {description.length > 160 ? `${description.slice(0, 157)}…` : description}
                  </p>
                </div>
                <div className="ai-wizard-recap-item">
                  <div className="row ai-wizard-recap-head">
                    <ListChecks size={14} aria-hidden="true" />
                    <span>Step 2 — Clarify</span>
                    <span className="ai-wizard-recap-done">
                      {answeredCount} of {questions.length}
                    </span>
                  </div>
                  <ul className="ai-wizard-recap-list">
                    {questions.length === 0 && <li>· No clarifying questions</li>}
                    {questions.map((q) => (
                      <li key={q}>
                        · {q.length > 40 ? `${q.slice(0, 37)}…` : q} →{' '}
                        <span className={(answers[q] ?? '').trim() ? 'ai-wizard-recap-answer' : 'ai-wizard-recap-skipped'}>
                          {(answers[q] ?? '').trim() || 'Skipped'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
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
            <p className="ai-wizard-epic-desc">
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
        <span key="prio" className="ai-wizard-tree-prio">{task.priority}</span>,
      ]}
      points={task.storyPoints}
      onRemove={onRemove}
    />
  );
}

const KIND_STYLE = {
  epic:  { icon: Layers,      label: 'Epic' },
  task:  { icon: CheckSquare, label: 'Task' },
  story: { icon: BookOpen,    label: 'Story' },
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
  const { icon: Icon, label } = KIND_STYLE[kind];
  const [editing, setEditing] = useState(false);
  return (
    <div className={`ai-wizard-tree-row row is-${kind} depth-${depth}`}>
      {hasChildren ? (
        <button
          type="button"
          className="ai-wizard-chevron"
          onClick={onToggle}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      ) : (
        <span className="ai-wizard-chevron-spacer" />
      )}
      <span className={`ai-wizard-kind is-${kind}`} title={label}>
        <Icon size={14} aria-hidden="true" />
        <span className="ai-wizard-sr">{label}</span>
      </span>
      {editing ? (
        <input
          className="input ai-wizard-tree-input grow"
          value={title}
          autoFocus
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span className="fill ai-wizard-tree-title">
          {title}
        </span>
      )}
      {badges.map((b, i) => (
        <span key={i}>{b}</span>
      ))}
      {points != null && (
        <span className="ai-wizard-tree-pts">{points} pt</span>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-icon-sm ai-wizard-tree-action"
        onClick={() => setEditing((v) => !v)}
        aria-label="Edit"
        title="Edit"
      >
        <Edit3 size={11} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-icon-sm ai-wizard-tree-action"
        onClick={onRemove}
        aria-label="Remove"
        title="Remove"
      >
        <Trash2 size={11} aria-hidden="true" />
      </button>
    </div>
  );
}
