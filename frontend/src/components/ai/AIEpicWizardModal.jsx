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

export function AIEpicWizardModal({ open, projectId, onClose, onCreated }) {
  const toast = useToast();
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      setError('Describe the epic in at least 10 characters.');
      return;
    }
    setLoading(true);
    try {
      const draft = await aiApi.generateEpic(projectId, {
        description: description.trim(),
      });
      setPreview(draft);
    } catch (err) {
      setError(describeAiError(err, 'Could not generate the epic. Try a different prompt.'));
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
    if ((preview.title ?? '').trim().length < 2) {
      setError('Epic title must be at least 2 characters.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const epic = await aiApi.applyEpic(projectId, preview);
      toast.show({ tone: 'success', message: 'Epic created.' });
      reset();
      onCreated?.(epic);
    } catch (err) {
      setError(describeAiError(err, 'Could not create the epic.'));
    } finally {
      setLoading(false);
    }
  }

  function updateTitle(v) {
    setPreview((p) => ({ ...p, title: v }));
  }
  function updateDescription(v) {
    setPreview((p) => ({ ...p, description: v }));
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

  const totals = preview
    ? {
        tasks: preview.tasks.length,
        points: preview.tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
      }
    : null;

  return (
    <Modal open={open} onClose={handleClose} labelledBy="ai-epic-title" size="lg">
      <ModalHeader>
        <AIChip label="AI" variant="gradient" />
        <h2 id="ai-epic-title" className="modal-title">
          {preview ? 'Review generated epic' : 'Plan an epic with AI'}
        </h2>
      </ModalHeader>
      <ModalBody>
        {error && <p className="ai-draft__error">{error}</p>}

        {!preview && (
          <div className="ai-draft__prompt">
            <label htmlFor="ai-epic-desc" className="ai-draft__label">
              Describe the epic
            </label>
            <textarea
              id="ai-epic-desc"
              data-autofocus
              className="ai-draft__textarea"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Build the billing system: pricing plans, Stripe checkout, prorations on plan changes, invoice history."
            />
            <p className="ai-draft__hint">
              AI sees existing epics in this project so it won't propose duplicates.
            </p>
          </div>
        )}

        {preview && (
          <div className="ai-draft__plan">
            <div className="ai-draft__plan-head hstack">
              <Sparkles size={14} color="var(--ai-2)" aria-hidden="true" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Generated epic</span>
              {totals && (
                <span className="mono dim" style={{ fontSize: 11 }}>
                  · {totals.tasks} tasks · {totals.points} points
                </span>
              )}
            </div>

            <div className="ai-draft__epic">
              <input
                className="input ai-draft__epic-title"
                value={preview.title}
                onChange={(e) => updateTitle(e.target.value)}
                placeholder="Epic title"
              />
              <textarea
                className="ai-draft__epic-desc"
                rows={2}
                value={preview.description ?? ''}
                onChange={(e) => updateDescription(e.target.value)}
                placeholder="Short description (optional)"
              />
            </div>

            <div className="ai-draft__tasks">
              {preview.tasks.map((t, i) => (
                <TaskRow
                  key={i}
                  task={t}
                  onChange={(patch) => updateTask(i, patch)}
                  onRemove={() => removeTask(i)}
                />
              ))}
              {preview.tasks.length === 0 && (
                <p className="ai-draft__empty">
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
              disabled={
                loading
                || preview.tasks.length === 0
                || (preview.title ?? '').trim().length < 2
              }
            >
              <Check size={13} aria-hidden="true" />
              {loading ? ' Creating…' : ' Create epic'}
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
    <div className="ai-draft__task hstack">
      <Badge tone={PRIORITY_TONES[task.priority] ?? 'neutral'}>{task.priority}</Badge>
      {editing ? (
        <input
          className="input ai-draft__task-input grow"
          value={task.title}
          autoFocus
          onChange={(e) => onChange({ title: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span className="grow ai-draft__task-title">{task.title}</span>
      )}
      <span className="mono dim ai-draft__task-pts">{task.storyPoints}pt</span>
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
