import { useEffect, useState } from 'react';
import { ChevronDown, Rocket, X } from 'lucide-react';
import { Dropdown } from '@/components/ui';
import { sprintsApi } from '@/api/sprints.api';
import './FieldPicker.css';

/**
 * Picker for the task's sprint. Lists Planning + Active sprints in the
 * project (Closed sprints are excluded from the picker — you can still
 * see the badge if the task is in one).
 */
export function SprintPicker({ projectId, value, onChange, disabled }) {
  const [sprints, setSprints] = useState([]);

  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    sprintsApi
      .listForProject(projectId)
      .then((list) => {
        if (!cancelled) setSprints(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const current = value ? sprints.find((s) => s.id === value) : null;
  const selectable = sprints.filter((s) => s.status !== 'Closed');

  return (
    <Dropdown
      trigger={
        <button type="button" className="field-picker__trigger" disabled={disabled}>
          <Rocket size={12} aria-hidden="true" />
          <span className="field-picker__label truncate">
            {current ? current.name : <span className="field-picker__placeholder">Backlog</span>}
          </span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      }
      align="start"
    >
      <Dropdown.Section>Sprint</Dropdown.Section>
      {value && (
        <Dropdown.Item onSelect={() => onChange?.(null)} icon={<X size={12} aria-hidden="true" />}>
          Move to backlog
        </Dropdown.Item>
      )}
      {value && <Dropdown.Divider />}
      {selectable.length === 0 && (
        <div className="field-picker__empty">No active or planned sprints.</div>
      )}
      {selectable.map((s) => (
        <Dropdown.Item
          key={s.id}
          onSelect={() => s.id !== value && onChange?.(s.id)}
          icon={
            <span
              className="field-picker__status-dot"
              data-status={s.status}
              aria-hidden="true"
            />
          }
        >
          {s.name}
          {s.status === 'Active' && (
            <span className="field-picker__hint">· active</span>
          )}
        </Dropdown.Item>
      ))}
    </Dropdown>
  );
}
