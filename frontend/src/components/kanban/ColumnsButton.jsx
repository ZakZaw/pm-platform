import { Columns3 } from 'lucide-react';
import { Button, Dropdown, StatusBadge } from '@/components/ui';
import { STATUS_MAP } from '@/components/ui/StatusBadge/constants';

const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');
function sameLabel(displayName, status) {
  const n = norm(displayName);
  return n === norm(status) || n === norm(STATUS_MAP[status]?.label);
}

/**
 * "Columns" picker — opens a dropdown of every workflow status with a
 * checkbox per status. Reuses Dropdown for positioning + viewport
 * containment; the items are clickable rows that flip their own check.
 *
 * Props:
 *   statuses: [{ status, displayName? }]
 *   isVisible(status) => boolean
 *   toggle(status)
 *   label?: button label override
 *   variant?, size?: trigger Button styling (defaults to a quiet ghost button)
 */
export function ColumnsButton({
  statuses,
  isVisible,
  toggle,
  label = 'Columns',
  variant = 'ghost',
  size = 'sm',
}) {
  const hidden = statuses.filter((s) => !isVisible(s.status)).length;
  return (
    <Dropdown
      align="end"
      trigger={
        <Button variant={variant} size={size}>
          <Columns3 size={14} aria-hidden="true" /> {label}
          {hidden > 0 && (
            <span className="columns-button-count" aria-label={`${hidden} hidden`}>
              {hidden}
            </span>
          )}
        </Button>
      }
    >
      <Dropdown.Section>Show columns</Dropdown.Section>
      {statuses.map((s) => {
        const shown = isVisible(s.status);
        return (
          <Dropdown.Item
            key={s.status}
            onSelect={() => toggle(s.status)}
            icon={
              <span
                className={['columns-button-check', shown ? 'is-on' : ''].filter(Boolean).join(' ')}
                aria-hidden="true"
              />
            }
          >
            <StatusBadge status={s.status} />
            {/* Only show the workflow alias when it actually differs from the status label. */}
            {s.displayName && !sameLabel(s.displayName, s.status) && (
              <span className="columns-button-alias">· {s.displayName}</span>
            )}
          </Dropdown.Item>
        );
      })}
    </Dropdown>
  );
}
