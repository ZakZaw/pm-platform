import { useEffect, useState } from 'react';
import { ChevronDown, Layers, X } from 'lucide-react';
import { Dropdown } from '@/components/ui';
import { epicsApi } from '@/api/epics.api';
import './FieldPicker.css';

const DEFAULT_COLOR = 'var(--accent)';

/**
 * Picker for the task's epic. Lists every non-archived epic in the project.
 * `value` is an epic id (or null). `onChange(epicId | null)` fires when the
 * user picks an epic or clears the assignment.
 */
export function EpicPicker({ projectId, value, onChange, disabled }) {
  const [epics, setEpics] = useState([]);

  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    epicsApi
      .listForProject(projectId)
      .then((list) => {
        if (!cancelled) setEpics(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const current = value ? epics.find((e) => e.id === value) : null;

  return (
    <Dropdown
      trigger={
        <button type="button" className="field-picker__trigger" disabled={disabled}>
          {current ? (
            <>
              <span
                className="field-picker__swatch"
                style={{ background: current.color || DEFAULT_COLOR }}
                aria-hidden="true"
              />
              <span className="field-picker__label truncate">{current.title}</span>
            </>
          ) : (
            <>
              <Layers size={12} aria-hidden="true" />
              <span className="field-picker__placeholder">No epic</span>
            </>
          )}
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      }
      align="start"
    >
      <Dropdown.Section>Epic</Dropdown.Section>
      {value && (
        <Dropdown.Item onSelect={() => onChange?.(null)} icon={<X size={12} aria-hidden="true" />}>
          Remove from epic
        </Dropdown.Item>
      )}
      {value && <Dropdown.Divider />}
      {epics.length === 0 && (
        <div className="field-picker__empty">No epics in this project yet.</div>
      )}
      {epics.map((e) => (
        <Dropdown.Item
          key={e.id}
          onSelect={() => e.id !== value && onChange?.(e.id)}
          icon={
            <span
              className="field-picker__swatch"
              style={{ background: e.color || DEFAULT_COLOR }}
              aria-hidden="true"
            />
          }
        >
          {e.title}
        </Dropdown.Item>
      ))}
    </Dropdown>
  );
}
