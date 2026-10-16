import { useEffect, useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  useToast,
} from '@/components/ui';
import { operationsApi, RECURRENCE_PRESETS } from '@/api/operations.api';
import './WorkflowEditorModal.css';

// Single modal handles both create + edit. Pass workflowId=null to
// create a fresh workflow, or a guid to edit an existing one.
export function WorkflowEditorModal({ projectId, workflowId, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(workflowId);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState('FREQ=WEEKLY');
  const [template, setTemplate] = useState([
    { title: '', sequential: false },
  ]);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const detail = await operationsApi.getWorkflow(workflowId);
        if (cancelled) return;
        const w = detail.workflow;
        setName(w.name);
        setDescription(w.description ?? '');
        setRecurrence(w.recurrenceRule ?? '');
        setTemplate(
          (w.template ?? []).map((t) => ({ title: t.title, sequential: t.sequential })),
        );
      } catch (err) {
        toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not load workflow.' });
        onClose?.();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, workflowId, onClose, toast]);

  function setItem(i, patch) {
    setTemplate((arr) => arr.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }
  function addItem() { setTemplate((arr) => [...arr, { title: '', sequential: false }]); }
  function removeItem(i) { setTemplate((arr) => arr.filter((_, idx) => idx !== i)); }
  function moveItem(i, delta) {
    setTemplate((arr) => {
      const next = [...arr];
      const j = i + delta;
      if (j < 0 || j >= next.length) return arr;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const cleaned = template
      .map((t, idx) => ({ title: t.title.trim(), order: idx + 1, sequential: t.sequential }))
      .filter((t) => t.title.length > 0);
    if (cleaned.length === 0) {
      toast.show({ tone: 'danger', message: 'Add at least one checklist item.' });
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await operationsApi.updateWorkflow(workflowId, {
          name: name.trim(),
          description: description.trim() || null,
          recurrenceRule: recurrence || null,
          clearRecurrence: !recurrence,
          template: cleaned,
        });
      } else {
        await operationsApi.createWorkflow(projectId, {
          name: name.trim(),
          description: description.trim() || null,
          recurrenceRule: recurrence || null,
          template: cleaned,
        });
      }
      onSaved?.();
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not save workflow.' });
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setSaving(true);
    try {
      await operationsApi.deleteWorkflow(workflowId);
      setConfirmDelete(false);
      onSaved?.();
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not delete workflow.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} labelledBy="workflow-editor-title" size="md">
      <form onSubmit={save}>
        <ModalHeader>
          <h2 id="workflow-editor-title" className="modal-title">
            {isEdit ? 'Edit workflow' : 'New workflow'}
          </h2>
        </ModalHeader>
        <ModalBody>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : (
            <div className="col gap-5">
              <Input
                label="Name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Monthly compliance review"
              />
              <Input
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="(optional)"
              />
              <Select
                label="Recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                options={RECURRENCE_PRESETS.map((p) => ({ value: p.rule, label: p.label }))}
              />
              <div>
                <div className="input-label">Checklist template</div>
                <ul className="wf-editor__items">
                  {template.map((item, i) => (
                    <li key={i} className="wf-editor__item">
                      <button
                        type="button"
                        className="icon-btn icon-btn-sm"
                        aria-label="Reorder"
                        onClick={() => moveItem(i, -1)}
                        disabled={i === 0}
                        title="Move up"
                      >
                        <GripVertical size={13} aria-hidden="true" />
                      </button>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => setItem(i, { title: e.target.value })}
                        placeholder={`Item ${i + 1}`}
                        aria-label={`Checklist item ${i + 1}`}
                        maxLength={300}
                        className="input wf-editor__input"
                      />
                      <label className="wf-editor__seq">
                        <input
                          type="checkbox"
                          checked={item.sequential}
                          onChange={(e) => setItem(i, { sequential: e.target.checked })}
                        />
                        Sequential
                      </label>
                      <button
                        type="button"
                        className="icon-btn icon-btn-sm"
                        aria-label="Remove item"
                        onClick={() => removeItem(i)}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="wf-editor__add">
                  <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                    <Plus size={13} aria-hidden="true" /> Add item
                  </Button>
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {isEdit && (
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              Delete
            </Button>
          )}
          <div className="grow" />
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create workflow'}
          </Button>
        </ModalFooter>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this workflow?"
        message="All scheduled runs and history will be removed. This cannot be undone."
        confirmLabel="Delete workflow"
        tone="danger"
        busy={saving}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Modal>
  );
}
