import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AssigneePicker, Button, Input, Select } from '@/components/ui';
import './TaskForm.css';

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Urgent', label: 'Urgent' },
];

export function TaskForm({ initial, onSubmit, onCancel, submitLabel = 'Create' }) {
  const { slug: orgSlug } = useParams();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority] = useState(initial?.priority ?? 'Medium');
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId ?? null);
  const [reviewerId, setReviewerId] = useState(initial?.reviewerId ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assigneeId: assigneeId ?? null,
        reviewerId: reviewerId ?? null,
      });
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not save task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="task-form">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoComplete="off"
        placeholder="What needs to happen?"
      />
      <label className="task-form__field">
        <span className="task-form__label">Description</span>
        <textarea
          className="task-form__textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Markdown supported. Render lands with the comments feature."
        />
      </label>
      <div className="task-form__row">
        <Select
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
        <AssigneePicker
          label="Assignee"
          orgSlug={orgSlug}
          value={assigneeId}
          onChange={setAssigneeId}
        />
        <AssigneePicker
          label="Reviewer"
          orgSlug={orgSlug}
          value={reviewerId}
          onChange={setReviewerId}
        />
      </div>

      {error && <p className="task-form__error">{error}</p>}

      <div className="task-form__actions">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" disabled={submitting || title.trim().length < 2}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
