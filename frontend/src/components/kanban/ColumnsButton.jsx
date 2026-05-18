import { Columns3 } from 'lucide-react';
import { Button, Dropdown, StatusBadge } from '@/components/ui';

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
 */
export function ColumnsButton({ statuses, isVisible, toggle, label = 'Columns' }) {
  const hidden = statuses.filter((s) => !isVisible(s.status)).length;
  return (
    <Dropdown
      align="end"
      trigger={
        <Button variant="secondary" size="md">
          <Columns3 size={14} aria-hidden="true" /> {label}
          {hidden > 0 && (
            <span className="columns-button__count" aria-label={`${hidden} hidden`}>
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
                className={['columns-button__check', shown ? 'is-on' : ''].join(' ')}
                aria-hidden="true"
              />
            }
          >
            <StatusBadge status={s.status} />
            {s.displayName && s.displayName !== s.status && (
              <span className="columns-button__alias">· {s.displayName}</span>
            )}
          </Dropdown.Item>
        );
      })}
    </Dropdown>
  );
}
