import { ChevronDown } from 'lucide-react';
import { Dropdown, Priority } from '@/components/ui';
import './PriorityDropdown.css';

const LEVELS = [
  { value: 'Urgent', label: 'Urgent' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

/**
 * Stratos priority picker — visually mirrors StatusDropdown. Shows the
 * current priority's bars + label, opens a menu of the four levels.
 */
export function PriorityDropdown({ value, onChange, disabled }) {
  const current = LEVELS.find((l) => l.value === value) ?? LEVELS[2];
  return (
    <Dropdown
      trigger={
        <button
          type="button"
          className="priority-dropdown__trigger"
          disabled={disabled}
        >
          <Priority level={value} />
          <span className="priority-dropdown__label">{current.label}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      }
      align="start"
    >
      {LEVELS.map((l) => (
        <Dropdown.Item
          key={l.value}
          onSelect={() => l.value !== value && onChange?.(l.value)}
        >
          <Priority level={l.value} />
          <span>{l.label}</span>
          {l.value === value && (
            <span className="priority-dropdown__current">· current</span>
          )}
        </Dropdown.Item>
      ))}
    </Dropdown>
  );
}
