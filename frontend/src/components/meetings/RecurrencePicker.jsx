import { useMemo } from 'react';
import { Select } from '@/components/ui';
import { DAY_ALIASES, DAY_LABELS, parseRule } from './recurrence';

/**
 * F2-19 RecurrencePicker — renders the three patterns the create form
 * needs (none, daily, weekly with day-of-week multi-select, monthly
 * by-day-of-month) and outputs a serialised RRULE string. The backend
 * stores the exact rule we emit; we don't try to support the full
 * RFC 5545 spec because the create UI doesn't expose it.
 *
 * Controlled component: takes the current `value` (RRULE string or
 * empty) and an `onChange(rrule)` callback. Empty string means
 * "no recurrence".
 */
export function RecurrencePicker({ value = '', onChange, scheduledAt }) {
  // The value prop is the source of truth — we derive the picker's
  // own UI state from it on every render. That keeps "no recurrence"
  // → "weekly Mon/Wed" → "no recurrence" round-trips coherent without
  // a useEffect mirror.
  const { freq, byDays } = useMemo(() => parseRule(value), [value]);

  function emit(nextFreq, nextDays) {
    if (nextFreq === 'NONE') {
      onChange?.('');
      return;
    }
    if (nextFreq === 'DAILY') {
      onChange?.('FREQ=DAILY');
      return;
    }
    if (nextFreq === 'WEEKLY') {
      // Default to the scheduledAt day if nothing's selected so the
      // rule is always actionable.
      const days = nextDays.length > 0
        ? nextDays
        : [DAY_ALIASES[scheduledAt ? new Date(scheduledAt).getDay() : 1]];
      onChange?.(`FREQ=WEEKLY;BYDAY=${days.join(',')}`);
      return;
    }
    if (nextFreq === 'MONTHLY') {
      const day = scheduledAt
        ? new Date(scheduledAt).getDate()
        : new Date().getDate();
      onChange?.(`FREQ=MONTHLY;BYMONTHDAY=${day}`);
    }
  }

  function changeFreq(next) {
    emit(next, byDays);
  }
  function toggleDay(code) {
    const set = new Set(byDays);
    if (set.has(code)) set.delete(code);
    else set.add(code);
    const ordered = DAY_ALIASES.filter((d) => set.has(d));
    emit(freq, ordered);
  }

  return (
    <div className="rrule-picker">
      <Select
        label="Repeats"
        value={freq}
        onChange={(e) => changeFreq(e.target.value)}
        options={[
          { value: 'NONE', label: "Doesn't repeat" },
          { value: 'DAILY', label: 'Daily' },
          { value: 'WEEKLY', label: 'Weekly' },
          { value: 'MONTHLY', label: 'Monthly' },
        ]}
      />
      {freq === 'WEEKLY' && (
        <div className="rrule-days" role="group" aria-label="Repeat on">
          {DAY_ALIASES.map((code, idx) => (
            <button
              key={code}
              type="button"
              className={['rrule-day', byDays.includes(code) && 'is-active']
                .filter(Boolean).join(' ')}
              onClick={() => toggleDay(code)}
              aria-pressed={byDays.includes(code)}
            >
              {DAY_LABELS[idx][0]}
            </button>
          ))}
        </div>
      )}
      {freq === 'MONTHLY' && scheduledAt && (
        <p className="muted rrule-hint">
          Repeats every month on day {new Date(scheduledAt).getDate()}.
        </p>
      )}
    </div>
  );
}

