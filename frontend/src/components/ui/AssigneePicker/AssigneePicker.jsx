import { useMemo, useState } from 'react';
import { UserMinus } from 'lucide-react';
import { Avatar } from '../Avatar/Avatar';
import { Dropdown } from '../Dropdown/Dropdown';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import './AssigneePicker.css';

/**
 * Picks a person from the org. Keeps presentation light: an avatar (or
 * "Unassigned" pill) that opens a menu of members + an Unassigned entry.
 *
 * Members are loaded via the shared useOrgMembers cache so multiple
 * pickers on the same page share one fetch.
 *
 *   <AssigneePicker
 *     orgSlug={orgSlug}
 *     value={story.assigneeId}
 *     onChange={(userId) => save({ assigneeId: userId })}
 *     size="sm"
 *   />
 */
export function AssigneePicker({
  orgSlug,
  value,
  onChange,
  size = 'sm',
  disabled = false,
  label,
  placeholder = 'Unassigned',
  className = '',
}) {
  const { members, loading } = useOrgMembers(orgSlug);
  const [query, setQuery] = useState('');

  const current = useMemo(
    () => (value ? members.find((m) => m.userId === value) ?? null : null),
    [members, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return members;
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        m.fullName?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q),
    );
  }, [members, query]);

  const trigger = (
    <button
      type="button"
      className={['assignee-picker__trigger', `is-${size}`, disabled ? 'is-disabled' : '']
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      title={current?.fullName ?? placeholder}
    >
      {current ? (
        <>
          <Avatar src={current.avatarUrl} name={current.fullName} size={size === 'md' ? 'sm' : 'xs'} />
          <span className="assignee-picker__name">{current.fullName}</span>
        </>
      ) : (
        <>
          <span className="assignee-picker__empty-dot" aria-hidden="true" />
          <span className="assignee-picker__name is-muted">{placeholder}</span>
        </>
      )}
    </button>
  );

  return (
    <div className={['assignee-picker', label ? 'is-field' : '', className].filter(Boolean).join(' ')}>
      {label && <span className="assignee-picker__label">{label}</span>}
      <Dropdown trigger={trigger} align="start" className="assignee-picker__dropdown">
        <div className="assignee-picker__search">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="assignee-picker__search-input"
            // Stop the Dropdown's outside-click close from firing.
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <Dropdown.Item
          onSelect={() => onChange?.(null)}
          icon={<UserMinus size={14} aria-hidden="true" />}
        >
          Unassigned
        </Dropdown.Item>

        {loading && <Dropdown.Section>Loading…</Dropdown.Section>}

        {!loading && filtered.length === 0 && (
          <Dropdown.Section>No matches</Dropdown.Section>
        )}

        {filtered.map((m) => (
          <Dropdown.Item
            key={m.userId}
            onSelect={() => onChange?.(m.userId)}
            icon={<Avatar src={m.avatarUrl} name={m.fullName} size="xs" />}
          >
            {m.fullName}
          </Dropdown.Item>
        ))}
      </Dropdown>
    </div>
  );
}
