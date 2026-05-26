import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import { Badge, useToast } from '@/components/ui';
import { labelsApi } from '@/api/labels.api';
import './LabelsSection.css';

const LABEL_TONES = ['neutral', 'info', 'purple', 'warning', 'danger', 'success', 'accent', 'rose'];

export function LabelsSection({ taskId, projectId, initial = [], onChange }) {
  const toast = useToast();
  const [labels, setLabels] = useState(initial);
  const [available, setAvailable] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTone, setNewTone] = useState('neutral');
  const wrapRef = useRef(null);

  // Fetch attached labels once on mount — TaskDto doesn't carry the join.
  useEffect(() => {
    if (!taskId) return undefined;
    if (initial && initial.length > 0) {
      setLabels(initial);
      return undefined;
    }
    let cancelled = false;
    labelsApi.listForTask(taskId)
      .then((rows) => { if (!cancelled) setLabels(rows); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const loadAvailable = useCallback(async () => {
    try {
      const list = await labelsApi.listForProject(projectId);
      setAvailable(list);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not load labels.',
      });
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (pickerOpen) loadAvailable();
  }, [pickerOpen, loadAvailable]);

  // Close picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return undefined;
    function onClick(e) {
      if (!wrapRef.current?.contains(e.target)) setPickerOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [pickerOpen]);

  const selectedIds = useMemo(() => new Set(labels.map((l) => l.id)), [labels]);

  async function toggle(label) {
    const next = selectedIds.has(label.id)
      ? labels.filter((l) => l.id !== label.id)
      : [...labels, label];
    const prev = labels;
    setLabels(next);
    try {
      const result = await labelsApi.setForTask(taskId, next.map((l) => l.id));
      setLabels(result);
      onChange?.(result);
    } catch (err) {
      setLabels(prev);
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not update labels.',
      });
    }
  }

  async function removeChip(label) {
    await toggle(label);
  }

  async function createLabel(e) {
    e.preventDefault();
    const name = newName.trim();
    if (name.length === 0) return;
    setCreating(true);
    try {
      const created = await labelsApi.create(projectId, { name, color: newTone });
      setAvailable((cur) => [...cur, created].sort((a, b) => a.name.localeCompare(b.name)));
      // Auto-attach to the task.
      await toggle(created);
      setNewName('');
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not create label.',
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="labels-section" ref={wrapRef}>
      <div className="row gap-2 labels-section__chips" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {labels.map((l) => (
          <span key={l.id} className={`badge badge-${l.color} labels-section__chip`}>
            <Tag size={9} aria-hidden="true" /> {l.name}
            <button
              type="button"
              className="labels-section__chip-x"
              onClick={() => removeChip(l)}
              aria-label={`Remove ${l.name}`}
            >
              <X size={10} aria-hidden="true" />
            </button>
          </span>
        ))}
        <button
          type="button"
          className="labels-section__add"
          onClick={() => setPickerOpen((v) => !v)}
        >
          <Plus size={11} aria-hidden="true" /> Label
        </button>
      </div>

      {pickerOpen && (
        <div className="menu labels-section__menu" role="menu">
          <div className="menu-label">Project labels</div>
          {available.length === 0 ? (
            <p className="muted" style={{ padding: 'var(--s-3) var(--s-4)' }}>
              No labels yet — create one below.
            </p>
          ) : (
            available.map((l) => (
              <button
                key={l.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={selectedIds.has(l.id)}
                className={`menu-item ${selectedIds.has(l.id) ? 'is-selected' : ''}`}
                onClick={() => toggle(l)}
              >
                <Badge tone={l.color}>
                  <Tag size={9} aria-hidden="true" /> {l.name}
                </Badge>
              </button>
            ))
          )}
          <div className="menu-sep" />
          <form onSubmit={createLabel} className="labels-section__form">
            <input
              className="input"
              type="text"
              placeholder="New label name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
            />
            <select
              className="input labels-section__tone"
              value={newTone}
              onChange={(e) => setNewTone(e.target.value)}
              aria-label="Color"
            >
              {LABEL_TONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!newName.trim() || creating}
            >
              {creating ? 'Adding…' : 'Add'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
