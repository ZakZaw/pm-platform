import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui';
import { customFieldsApi } from '@/api/customFields.api';
import './CustomFieldsSection.css';

/**
 * Renders the custom-field schema (definitions) for a task's project,
 * seeded with the task's saved values, and lets the user edit each. Saves
 * are debounced; required-field validation is enforced server-side by
 * SetTaskCustomFieldValuesCommand — the server's RequiredMissing error is
 * surfaced as a toast.
 *
 * Used by TaskDetail (drawer view). For TaskForm (create flow), required
 * fields aren't enforced at create time today — the user fills them in
 * after creation. F2-05 follow-up: collect required values during create
 * and reject the form if any are missing.
 */
export function CustomFieldsSection({ taskId, projectId }) {
  const toast = useToast();
  const [defs, setDefs] = useState([]);
  // values: Map<definitionId, parsed JS value>
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!projectId || !taskId) return;
    setLoading(true);
    try {
      const [d, v] = await Promise.all([
        customFieldsApi.list(projectId),
        customFieldsApi.getValues(taskId),
      ]);
      setDefs(d);
      const initial = {};
      for (const row of v) {
        try { initial[row.definitionId] = JSON.parse(row.valueJson); }
        catch { /* corrupt row — drop */ }
      }
      setValues(initial);
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not load custom fields.');
    } finally {
      setLoading(false);
    }
  }, [taskId, projectId]);

  useEffect(() => { load(); }, [load]);

  // Debounced save. We send only the changed field per write to keep the
  // round-trip narrow; the server merges with existing rows.
  const saveTimer = useRef(null);
  const pendingRef = useRef(new Map());

  const flush = useCallback(async () => {
    if (pendingRef.current.size === 0) return;
    const payload = [...pendingRef.current.entries()].map(([definitionId, value]) => ({
      definitionId,
      value,
    }));
    pendingRef.current.clear();
    try {
      await customFieldsApi.setValues(taskId, payload);
    } catch (err) {
      // Reload to drop any optimistic state and surface the failure.
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not save field.' });
      load();
    }
  }, [taskId, toast, load]);

  const queueSave = useCallback((definitionId, value) => {
    pendingRef.current.set(definitionId, value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 400);
  }, [flush]);

  // Flush on unmount so a quick close doesn't lose pending edits.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flush();
  }, [flush]);

  const visibleDefs = useMemo(
    () => [...defs].sort((a, b) => a.sortOrder - b.sortOrder),
    [defs],
  );

  if (loading && defs.length === 0) return null;
  if (error) return <p className="muted cf-section-error">{error}</p>;
  if (visibleDefs.length === 0) return null;

  const handleChange = (def, raw) => {
    setValues((cur) => ({ ...cur, [def.id]: raw }));
    queueSave(def.id, raw);
  };

  return (
    <div className="cf-section">
      <div className="cf-section__title label-key">Fields</div>
      <div className="cf-section__grid">
        {visibleDefs.map((def) => (
          <div key={def.id} className="drawer-prop cf-section__row">
            <span className="label-key">
              {def.name}
              {def.required && <span className="cf-section__required" title="Required"> *</span>}
            </span>
            <FieldInput def={def} value={values[def.id]} onChange={(v) => handleChange(def, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldInput({ def, value, onChange }) {
  switch (def.fieldType) {
    case 'Text':
      return <TextInput value={value ?? ''} onCommit={(v) => onChange(v === '' ? null : v)} />;
    case 'Number':
      return <NumberInput value={value} onCommit={(v) => onChange(v)} />;
    case 'Date':
      return <DateInput value={value ?? ''} onChange={(v) => onChange(v === '' ? null : v)} />;
    case 'SingleSelect':
      return (
        <select
          className="cf-section__select"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">—</option>
          {(def.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'MultiSelect':
      return <MultiSelectInput options={def.options ?? []} value={value ?? []} onChange={onChange} />;
    default:
      return <span className="muted">Unsupported field type</span>;
  }
}

function TextInput({ value, onCommit }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      type="text"
      className="cf-section__input"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') { setLocal(value); e.currentTarget.blur(); }
      }}
    />
  );
}

function NumberInput({ value, onCommit }) {
  const [local, setLocal] = useState(value == null ? '' : String(value));
  useEffect(() => { setLocal(value == null ? '' : String(value)); }, [value]);
  return (
    <input
      type="number"
      className="cf-section__input cf-section__input--num"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local === '') return onCommit(null);
        const n = Number(local);
        if (Number.isFinite(n)) onCommit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') { setLocal(value == null ? '' : String(value)); e.currentTarget.blur(); }
      }}
    />
  );
}

function DateInput({ value, onChange }) {
  return (
    <input
      type="date"
      className="cf-section__input"
      value={value ? value.slice(0, 10) : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function MultiSelectInput({ options, value, onChange }) {
  const set = new Set(value);
  const toggle = (opt) => {
    const next = new Set(set);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange([...next]);
  };
  return (
    <div className="row gap-2 wrap cf-section__multi">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`chip ${set.has(opt) ? 'is-active' : ''}`}
          onClick={() => toggle(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
