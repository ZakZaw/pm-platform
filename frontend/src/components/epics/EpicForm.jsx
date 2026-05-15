import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import './EpicForm.css';

const COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4', '#A855F7', '#EC4899'];

export function EpicForm({ initial, onSubmit, onCancel, submitLabel = 'Create' }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), description: description.trim() || null, color });
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not save epic.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="epic-form">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Onboarding rewrite"
        autoComplete="off"
        required
      />
      <label className="epic-form__field">
        <span className="epic-form__label">Description</span>
        <textarea
          className="epic-form__textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Short summary so teammates know the scope."
        />
      </label>

      <div className="epic-form__field">
        <span className="epic-form__label">Color</span>
        <div className="epic-form__colors">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={['epic-form__color', color === c ? 'is-active' : ''].filter(Boolean).join(' ')}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>

      {error && <p className="epic-form__error">{error}</p>}

      <div className="epic-form__actions">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting || title.trim().length < 2}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
