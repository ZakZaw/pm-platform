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
  // F2-14 — preview now carries the AI epic AND a timeline impact
  // projection. Shape: { epic: AIGeneratedEpicDto, impact: ... }
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // F2-14 — destination picker. null = backlog; otherwise a sprint id
  // chosen from the impact panel.
  const [targetSprintId, setTargetSprintId] = useState(null);

  function reset() {
    setDescription('');
    setPreview(null);
    setError(null);
    setTargetSprintId(null);
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
      // F2-14 — the breakdown endpoint returns both the AI epic and a
      // timeline-impact projection in one round-trip.
      const draft = await aiApi.breakdownFeature(projectId, {
        description: description.trim(),
      });
      setPreview(draft);
      setTargetSprintId(null);
    } catch (err) {
      setError(describeAiError(err, 'Could not generate the epic. Try a different prompt.'));
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    setPreview(null);
    setTargetSprintId(null);
    await generate();
  }

  async function confirm() {
    if (!preview?.epic) return;
    if ((preview.epic.title ?? '').trim().length < 2) {
      setError('Epic title must be at least 2 characters.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const epic = await aiApi.applyEpic(projectId, preview.epic, { targetSprintId });
      toast.show({
        tone: 'success',
        message: targetSprintId
          ? 'Epic created and added to sprint.'
          : 'Epic created in backlog.',
      });
      reset();
      onCreated?.(epic);
    } catch (err) {
      setError(describeAiError(err, 'Could not create the epic.'));
    } finally {
      setLoading(false);
    }
  }

  function updateTitle(v) {
    setPreview((p) => ({ ...p, epic: { ...p.epic, title: v } }));
  }
  function updateDescription(v) {
    setPreview((p) => ({ ...p, epic: { ...p.epic, description: v } }));
  }
  function updateTask(idx, patch) {
    setPreview((p) => ({
      ...p,
      epic: {
        ...p.epic,
        tasks: p.epic.tasks.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
      },
    }));
  }
  function removeTask(idx) {
    setPreview((p) => ({
      ...p,
      epic: {
        ...p.epic,
        tasks: p.epic.tasks.filter((_, i) => i !== idx),
      },
    }));
  }

  const totals = preview?.epic
    ? {
        tasks: preview.epic.tasks.length,
        points: preview.epic.tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
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

        {preview?.epic && (
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
                value={preview.epic.title}
                onChange={(e) => updateTitle(e.target.value)}
                placeholder="Epic title"
              />
              <textarea
                className="ai-draft__epic-desc"
                rows={2}
                value={preview.epic.description ?? ''}
                onChange={(e) => updateDescription(e.target.value)}
                placeholder="Short description (optional)"
              />
            </div>

            <div className="ai-draft__tasks">
              {preview.epic.tasks.map((t, i) => (
                <TaskRow
                  key={i}
                  task={t}
                  onChange={(patch) => updateTask(i, patch)}
                  onRemove={() => removeTask(i)}
                />
              ))}
              {preview.epic.tasks.length === 0 && (
                <p className="ai-draft__empty">
                  All tasks removed. Regenerate or close to start over.
                </p>
              )}
            </div>

            {preview.impact && <TimelineImpactPanel impact={preview.impact} />}
            {preview.impact && (
              <DestinationPicker
                impact={preview.impact}
                value={targetSprintId}
                onChange={setTargetSprintId}
              />
            )}
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
                || !preview?.epic
                || preview.epic.tasks.length === 0
                || (preview.epic.title ?? '').trim().length < 2
              }
            >
              <Check size={13} aria-hidden="true" />
              {loading
                ? ' Creating…'
                : targetSprintId
                  ? ' Add to sprint'
                  : ' Add to backlog'}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}

// F2-14 — read-only summary of how the generated epic would land on
// the project's existing work: estimated sprints to complete, which
// open sprints would overflow, which milestones would shift.
function TimelineImpactPanel({ impact }) {
  const velocityNote = impact.hasHistoricalVelocity
    ? `Based on a velocity of ${impact.projectVelocityPointsPerSprint}pt / ${impact.averageSprintLengthDays}d sprint.`
    : `No closed-sprint history yet — using a fallback velocity of ${impact.projectVelocityPointsPerSprint}pt.`;
  return (
    <div className="ai-draft__impact" aria-label="Timeline impact">
      <div className="ai-draft__impact-head">Timeline impact</div>
      <div className="ai-draft__impact-summary">
        {impact.addedStoryPoints}pt added · ~{impact.estimatedSprintsToComplete} sprint{impact.estimatedSprintsToComplete === 1 ? '' : 's'}
        {impact.projectedShiftDays > 0 ? ` · ~${impact.projectedShiftDays}d of downstream work` : ''}.
        {' '}{velocityNote}
      </div>

      <div className="ai-draft__impact-head" style={{ fontSize: 'var(--fs-xs)' }}>Open sprints</div>
      {impact.sprints.length === 0 ? (
        <p className="ai-draft__impact-empty">No planning or active sprints in this project.</p>
      ) : (
        <ul className="ai-draft__impact-list">
          {impact.sprints.map((s) => (
            <li
              key={s.sprintId}
              className={`ai-draft__impact-row${s.projectedOverflowPoints > 0 ? ' is-warn' : ''}`}
            >
              <span className="ai-draft__impact-row-name">
                {s.name} <span className="muted">· {s.status}</span>
              </span>
              <span className="ai-draft__impact-row-meta">
                {s.committedPoints}/{s.targetPoints}pt committed ·
                {' '}{s.projectedOverflowPoints > 0
                  ? `${s.projectedOverflowPoints}pt overflow`
                  : `${s.remainingCapacityPoints}pt free`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="ai-draft__impact-head" style={{ fontSize: 'var(--fs-xs)' }}>Milestones in next 90 days</div>
      {impact.milestones.length === 0 ? (
        <p className="ai-draft__impact-empty">No upcoming milestones within the projection window.</p>
      ) : (
        <ul className="ai-draft__impact-list">
          {impact.milestones.map((m) => (
            <li
              key={m.milestoneId}
              className={`ai-draft__impact-row${m.projectedShiftDays > 0 ? ' is-warn' : ''}`}
            >
              <span className="ai-draft__impact-row-name">{m.title}</span>
              <span className="ai-draft__impact-row-meta">
                in {m.daysUntil}d ·
                {' '}{m.projectedShiftDays > 0 ? `+${m.projectedShiftDays}d shift` : 'no shift'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// F2-14 — destination picker driving the apply-epic targetSprintId.
// Always shows "Backlog" as the first option; open sprints follow,
// ordered as the impact panel returned them. Sprints whose status is
// Closed never appear here (the backend filters them out before
// projection runs).
function DestinationPicker({ impact, value, onChange }) {
  return (
    <div className="ai-draft__destination" role="radiogroup" aria-label="Destination">
      <div className="ai-draft__destination-head">Add to…</div>
      <div className="ai-draft__destination-options">
        <label className={`ai-draft__destination-opt${value === null ? ' is-selected' : ''}`}>
          <input
            type="radio"
            name="ai-epic-destination"
            checked={value === null}
            onChange={() => onChange(null)}
          />
          <span>Backlog</span>
          <span className="ai-draft__destination-opt-meta">tasks land unsprinted</span>
        </label>
        {impact.sprints.map((s) => (
          <label
            key={s.sprintId}
            className={[
              'ai-draft__destination-opt',
              value === s.sprintId ? 'is-selected' : '',
              s.projectedOverflowPoints > 0 ? 'is-warn' : '',
            ].filter(Boolean).join(' ')}
          >
            <input
              type="radio"
              name="ai-epic-destination"
              checked={value === s.sprintId}
              onChange={() => onChange(s.sprintId)}
            />
            <span>
              {s.name} <span className="muted">· {s.status}</span>
            </span>
            <span className="ai-draft__destination-opt-meta">
              {s.projectedOverflowPoints > 0
                ? `would overflow by ${s.projectedOverflowPoints}pt`
                : `${s.remainingCapacityPoints}pt free`}
            </span>
          </label>
        ))}
      </div>
    </div>
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
