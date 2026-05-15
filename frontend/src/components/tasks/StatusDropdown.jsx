import { ChevronDown } from 'lucide-react';
import { Dropdown, StatusBadge, TASK_STATUSES } from '@/components/ui';
import './StatusDropdown.css';

/**
 * Drop-down used on the task detail view. We intentionally always render
 * the full status list and let the server enforce the state machine — the
 * UI catches the 422 and surfaces a toast (see TaskDetail). The list of
 * allowable transitions is the server's source of truth, not the client's.
 */
export function StatusDropdown({ status, onChange, disabled }) {
  return (
    <Dropdown
      trigger={
        <button
          type="button"
          className="status-dropdown__trigger"
          disabled={disabled}
        >
          <StatusBadge status={status} />
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      }
      align="start"
    >
      {TASK_STATUSES.map((s) => (
        <Dropdown.Item key={s} onSelect={() => s !== status && onChange(s)}>
          <StatusBadge status={s} />
          {s === status && <span className="status-dropdown__current">· current</span>}
        </Dropdown.Item>
      ))}
    </Dropdown>
  );
}
