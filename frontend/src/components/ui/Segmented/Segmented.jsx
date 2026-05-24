import './Segmented.css';

/**
 * Segmented control. Styled by .seg in stratos.css.
 *
 *   <Segmented value={v} onChange={setV} options={[
 *     { value: 'today',   label: 'Today' },
 *     { value: 'week',    label: 'This week', count: 12 },
 *   ]} />
 */
export function Segmented({ value, onChange, options, size = 'md', ariaLabel }) {
  return (
    <div
      className={['seg', size === 'sm' ? 'seg-sm' : ''].filter(Boolean).join(' ')}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={isActive ? 'is-active' : ''}
            onClick={() => !isActive && onChange?.(opt.value)}
            disabled={opt.disabled}
          >
            {opt.label}
            {opt.count != null && <span className="seg-count">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
