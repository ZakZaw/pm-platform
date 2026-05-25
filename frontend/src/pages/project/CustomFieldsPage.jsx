import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  useToast,
} from '@/components/ui';
import { customFieldsApi } from '@/api/customFields.api';
import { projectsApi } from '@/api/projects.api';
import { useConfirm } from '@/hooks/useConfirm';
import './CustomFieldsPage.css';

const FIELD_TYPES = [
  { value: 'Text', label: 'Text' },
  { value: 'Number', label: 'Number' },
  { value: 'Date', label: 'Date' },
  { value: 'SingleSelect', label: 'Single-select' },
  { value: 'MultiSelect', label: 'Multi-select' },
];

const TYPE_LABEL = Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t.label]));

export function CustomFieldsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [project, setProject] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const refresh = useCallback(async (projectId) => {
    const rows = await customFieldsApi.list(projectId);
    setFields(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load custom fields.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, refresh]);

  const handleReorder = async (e) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(fields, oldIndex, newIndex);
    setFields(reordered);
    // Persist new order by patching each field's SortOrder. Each call is
    // cheap; we run them sequentially to avoid racing on the same backend
    // transaction. Errors fall back to a full refresh.
    try {
      for (let i = 0; i < reordered.length; i += 1) {
        const f = reordered[i];
        if (f.sortOrder !== i) {
          await customFieldsApi.update(project.id, f.id, {
            name: f.name,
            options: f.options,
            required: f.required,
            sortOrder: i,
          });
        }
      }
      await refresh(project.id);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not save field order.' });
      refresh(project.id).catch(() => {});
    }
  };

  const handleCreate = async (body) => {
    try {
      const created = await customFieldsApi.create(project.id, body);
      setFields((cur) => [...cur, created].sort((a, b) => a.sortOrder - b.sortOrder));
      setAddOpen(false);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not create field.' });
    }
  };

  const handleUpdate = async (field, body) => {
    try {
      const saved = await customFieldsApi.update(project.id, field.id, body);
      setFields((cur) => cur.map((f) => f.id === saved.id ? saved : f));
      setEditing(null);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not update field.' });
    }
  };

  const handleDelete = async (field) => {
    const ok = await confirm({
      title: `Delete "${field.name}"?`,
      message: 'Existing values are preserved for audit, but the field disappears from all tasks. This cannot be undone.',
      confirmLabel: 'Delete field',
    });
    if (!ok) return;
    try {
      await customFieldsApi.remove(project.id, field.id);
      setFields((cur) => cur.filter((f) => f.id !== field.id));
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not delete field.' });
    }
  };

  if (loading) return <div className="main-inner"><p className="muted">Loading…</p></div>;
  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner custom-fields">
      {dialog}
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{project?.name ?? 'Project'} · Settings</div>
            <h1 className="page-title">Custom fields</h1>
            <p className="page-subtitle" style={{ marginTop: 6 }}>
              Add project-specific fields that appear on every task. Soft-delete keeps historical values
              while removing the field from the task UI.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={13} aria-hidden="true" /> Add field
          </Button>
        </div>
      </div>

      <Card className="cf-card">
        {fields.length === 0 ? (
          <p className="muted cf-empty">No custom fields yet. Add one to get started.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <ul className="cf-list">
                {fields.map((f) => (
                  <FieldRow
                    key={f.id}
                    field={f}
                    onEdit={() => setEditing(f)}
                    onDelete={() => handleDelete(f)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      <FieldFormModal
        open={addOpen}
        title="Add custom field"
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
      />
      <FieldFormModal
        open={!!editing}
        title="Edit custom field"
        initial={editing}
        onClose={() => setEditing(null)}
        onSubmit={(body) => handleUpdate(editing, body)}
      />
    </div>
  );
}

function FieldRow({ field, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="cf-row">
      <button type="button" className="cf-row__grip" {...attributes} {...listeners} aria-label="Drag to reorder">
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <div className="cf-row__main">
        <div className="cf-row__name">
          {field.name}
          {field.required && <Badge tone="warning">Required</Badge>}
        </div>
        <div className="cf-row__meta">
          <span>{TYPE_LABEL[field.fieldType] ?? field.fieldType}</span>
          {field.options && field.options.length > 0 && (
            <span className="muted">· {field.options.join(', ')}</span>
          )}
        </div>
      </div>
      <div className="row gap-2">
        <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onDelete} aria-label={`Delete ${field.name}`}>
          <Trash2 size={13} aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

function FieldFormModal({ open, title, initial, onClose, onSubmit }) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [fieldType, setFieldType] = useState('Text');
  const [required, setRequired] = useState(false);
  const [optionDraft, setOptionDraft] = useState('');
  const [options, setOptions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setFieldType(initial?.fieldType ?? 'Text');
    setRequired(initial?.required ?? false);
    setOptions(initial?.options ?? []);
    setOptionDraft('');
    setErr(null);
  }, [open, initial]);

  const isSelect = fieldType === 'SingleSelect' || fieldType === 'MultiSelect';

  const addOption = () => {
    const v = optionDraft.trim();
    if (!v || options.includes(v)) return;
    setOptions((cur) => [...cur, v]);
    setOptionDraft('');
  };

  const removeOption = (opt) => setOptions((cur) => cur.filter((o) => o !== opt));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 1) { setErr('Name is required.'); return; }
    if (isSelect && options.length === 0) {
      setErr('Select fields need at least one option.');
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        options: isSelect ? options : null,
        required,
      };
      if (!isEdit) body.fieldType = fieldType;
      await onSubmit(body);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open onClose={onClose} labelledBy="cf-modal-title" size="md">
      <form onSubmit={submit}>
        <ModalHeader>
          <h3 id="cf-modal-title" className="modal-title">{title}</h3>
        </ModalHeader>
        <ModalBody>
          <div className="col gap-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={120}
            />
            {!isEdit && (
              <Select
                label="Type"
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value)}
                options={FIELD_TYPES}
              />
            )}
            {isEdit && (
              <div className="col gap-1">
                <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Type</span>
                <span>{TYPE_LABEL[fieldType] ?? fieldType} <span className="muted">(can't change after creation)</span></span>
              </div>
            )}
            {isSelect && (
              <div className="col gap-2">
                <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Options</span>
                <div className="row gap-2 wrap">
                  {options.map((opt) => (
                    <span key={opt} className="chip is-active cf-option-chip">
                      {opt}
                      <button type="button" onClick={() => removeOption(opt)} aria-label={`Remove ${opt}`}>
                        <X size={11} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="row gap-2">
                  <input
                    type="text"
                    className="input"
                    placeholder="Add option…"
                    value={optionDraft}
                    onChange={(e) => setOptionDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addOption(); }
                    }}
                    maxLength={120}
                  />
                  <Button type="button" size="sm" onClick={addOption} disabled={!optionDraft.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            )}
            <label className="row gap-2 center">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              />
              <span>Required when saving a task</span>
            </label>
            {err && <p className="cf-error">{err}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {isEdit ? 'Save changes' : 'Add field'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
