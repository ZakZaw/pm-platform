import { useState } from 'react';
import { Check, Edit3, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import {
  AIChip,
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  useToast,
} from '@/components/ui';
import { aiApi } from '@/api/ai.api';
import { describeAiError } from './aiErrors';
import './AIDraftWizard.css';

const PRIORITY_TONES = {
  Urgent: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
};

/**
 * Bulk task generator. Two ways to mount:
 *   <AITaskListWizardModal projectId .../>                — generic, picks epic in modal
 *   <AITaskListWizardModal projectId epicId fixedEpic .../> — epic preselected, picker hidden
 *
 * `epicOptions` is [{ value, label }]; when empty we render only "(no epic)".
 */
export function AITaskListWizardModal({
  open,
  projectId,
  epicId: initialEpicId = null,
  fixedEpic = false,
  epicOptions = [],
  onClose,
  onCreated,
}) {
  const toast = useToast();
  const [description, setDescription] = useState('');
  const [epicId, setEpicId] = useState(initialEpicId ?? '');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Re-seed the epic picker during render whenever the modal opens or the
  // caller's preselected epic changes.
  const [prevSeed, setPrevSeed] = useState({ open: false, initialEpicId });
  if (open !== prevSeed.open || initialEpicId !== prevSeed.initialEpicId) {
    setPrevSeed({ open, initialEpicId });
    if (open) setEpicId(initialEpicId ?? '');
  }

  function reset() {
    setDescription('');
    setPreview(null);
    setError(null);
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose?.();
  }

  async function generate() {
    setError(null);
    if (description.trim().length < 10) {
      setError('Describe what tasks you need in at least 10 characters.');
      return;
    }
    setLoading(true);
    try {
      const draft = await aiApi.generateTasks(projectId, {
        description: description.trim(),
        epicId: epicId || null,
      });
      setPreview(draft);
    } catch (err) {
      setError(describeAiError(err, 'Could not generate tasks. Try a different prompt.'));
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    setPreview(null);
    await generate();
  }

  async function confirm() {
    if (!preview) return;
    setError(null);
    setLoading(true);
    try {
      const created = await aiApi.applyTasks(projectId, {
        epicId: preview.epicId,
        tasks: preview.tasks,
      });
      toast.show({
        tone: 'success',
        message:
          created.length === 1
            ? '1 task created.'
            : `${created.length} tasks created.`,
      });
      reset();
      onCreated?.(created);
    } catch (err) {
      setError(describeAiError(err, 'Could not save tasks.'));
    } finally {
      setLoading(false);
    }
  }

  function updateTask(idx, patch) {
    setPreview((p) => ({
      ...p,
      tasks: p.tasks.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  }
  function removeTask(idx) {
    setPreview((p) => ({
      ...p,
      tasks: p.tasks.filter((_, i) => i !== idx),
    }));
  }

  const totalPts = preview
    ? preview.tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0)
    : 0;

  const fullEpicOptions = [
    { value: '', label: '(no epic)' },
    ...epicOptions,
  ];

  return (
    <Modal open={open} onClose={handleClose} labelledBy="ai-tasks-title" size="lg">
      <ModalHeader>
        <AIChip label="AI" variant="gradient" />
        <h2 id="ai-tasks-title" className="modal-title">
          {preview ? 'Review generated tasks' : 'Generate tasks with AI'}
        </h2>
      </ModalHeader>
      <ModalBody>
        {error && <p className="ai-draft-error">{error}</p>}

        {!preview && (
          <>
            {!fixedEpic && epicOptions.length > 0 && (
              <div className="ai-draft-select-row">
                <Select
                  label="Add to epic"
                  value={epicId}
                  options={fullEpicOptions}
                  onChange={(e) => setEpicId(e.target.value)}
                />
              </div>
            )}
            <div className="ai-draft-prompt">
              <label htmlFor="ai-tasks-desc" className="ai-draft-label">
                What tasks do you need?
              </label>
              <textarea
                id="ai-tasks-desc"
                data-autofocus
                className="ai-draft-textarea"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Wire up password reset: email entry page, send reset link, set new password, expire old sessions."
              />
              <p className="ai-draft-hint">
                AI will return 3–8 sprint-sized tasks with acceptance criteria. Edit anything before confirming.
              </p>
            </div>
          </>
        )}

        {preview && (
          <div className="ai-draft-plan">
            <div className="ai-draft-list-meta">
              <Sparkles size={13} color="var(--ai-2)" aria-hidden="true" />
              <span className="ai-draft-plan-title">
                {preview.tasks.length} tasks · {totalPts} points
              </span>
              {preview.epicTitle && (
                <span>
                  · adds to{' '}
                  <Badge tone="purple">{preview.epicTitle}</Badge>
                </span>
              )}
            </div>
            <div className="ai-draft-tasks">
              {preview.tasks.map((t, i) => (
                <TaskRow
                  key={i}
                  task={t}
                  onChange={(patch) => updateTask(i, patch)}
                  onRemove={() => removeTask(i)}
                />
              ))}
              {preview.tasks.length === 0 && (
                <p className="ai-draft-empty">
                  All tasks removed. Regenerate or close to start over.
                </p>
              )}
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        {!preview && (
          <Button
            variant="ai"
            onClick={generate}
            disabled={loading || description.trim().length < 10}
          >
            <Sparkles size={13} aria-hidden="true" />
            {loading ? ' Generating…' : ' Generate'}
          </Button>
        )}
        {preview && (
          <>
            <Button variant="ghost" onClick={regenerate} disabled={loading}>
              <RefreshCw size={13} aria-hidden="true" /> Regenerate
            </Button>
            <Button
              variant="ai"
              onClick={confirm}
              disabled={loading || preview.tasks.length === 0}
            >
              <Check size={13} aria-hidden="true" />
              {loading
                ? ' Saving…'
                : preview.tasks.length === 1
                  ? ' Create task'
                  : ` Create ${preview.tasks.length} tasks`}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}

function TaskRow({ task, onChange, onRemove }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="ai-draft-task hstack">
      <Badge tone={PRIORITY_TONES[task.priority] ?? 'neutral'}>{task.priority}</Badge>
      {editing ? (
        <input
          className="input ai-draft-task-input grow"
          value={task.title}
          autoFocus
          onChange={(e) => onChange({ title: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span className="grow ai-draft-task-title">{task.title}</span>
      )}
      <span className="mono dim ai-draft-task-pts">{task.storyPoints}pt</span>
      <button
        type="button"
        className="icon-btn icon-btn-sm"
        onClick={() => setEditing((v) => !v)}
        title="Edit title"
        aria-label="Edit title"
      >
        <Edit3 size={11} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-btn icon-btn-sm"
        onClick={onRemove}
        title="Remove"
        aria-label="Remove"
      >
        <Trash2 size={11} aria-hidden="true" />
      </button>
    </div>
  );
}
