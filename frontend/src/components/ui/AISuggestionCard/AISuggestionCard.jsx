import { Check, Edit3, Info, RotateCcw, X } from 'lucide-react';
import { AIChip } from '../AIChip/AIChip';
import { Button } from '../Button/Button';
import './AISuggestionCard.css';

/**
 * AI-shaped insight surface from /Design Files/screen-ai-suggest.jsx.
 *
 * Three call shapes (auto-detected from props):
 *  1) Default suggestion: title + body + (optional) options + footer.
 *  2) Auto-applied: variant="auto" replaces the footer with an undo banner.
 *  3) Compact inline: compact=true, used for "this sprint will miss…" lines.
 *
 * Stays presentational — callers wire dismiss/edit/apply/undo. The card
 * never calls the API itself.
 */
export function AISuggestionCard({
  compact = false,
  // Full-card props
  chipLabel = 'Stratos insight',
  scope,
  title,
  body,
  options,
  selectedOptionIndex,
  onSelect,
  footer,
  onDismiss,
  onEdit,
  onApply,
  applyLabel = 'Apply',
  applyDisabled = false,
  loading = false,
  variant = 'default',
  undoMessage,
  undoSubtext,
  onUndo,
  // Compact-card props
  message,
  actionLabel,
  onAction,
  className = '',
}) {
  if (compact) {
    return (
      <div className={['card-ai', 'ai-suggest', 'ai-suggest--compact', className].filter(Boolean).join(' ')}>
        <div className="hstack ai-suggest__compact-row">
          <AIChip label={chipLabel} variant="gradient" />
          <span className="ai-suggest__compact-msg">{message}</span>
          {actionLabel && onAction && (
            <button
              type="button"
              className="ai-suggest__compact-action"
              onClick={onAction}
            >
              {actionLabel}
            </button>
          )}
          <span className="grow" />
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={['card-ai', 'ai-suggest', className].filter(Boolean).join(' ')}>
      <div className="ai-suggest__header hstack">
        <AIChip label={chipLabel} variant="gradient" />
        {scope && <span className="ai-suggest__scope">· {scope}</span>}
        <span className="grow" />
        {onDismiss && (
          <button
            type="button"
            className="ai-suggest__close"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {title && <div className="ai-suggest__title">{title}</div>}
      {body && <div className="ai-suggest__body">{body}</div>}

      {options && options.length > 0 && (
        <div className="ai-suggest__options vstack">
          {options.map((opt, i) => {
            const selected = selectedOptionIndex === i;
            return (
              <button
                type="button"
                key={i}
                className={[
                  'ai-suggest__option',
                  selected ? 'is-selected' : '',
                  opt.recommended ? 'is-recommended' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onSelect?.(i)}
              >
                <span
                  className={['ai-suggest__radio', selected ? 'is-selected' : ''].filter(Boolean).join(' ')}
                  aria-hidden="true"
                >
                  {selected && <span className="ai-suggest__radio-dot" />}
                </span>
                <span className="ai-suggest__option-label">{opt.label}</span>
                {opt.recommended && (
                  <span className="ai-suggest__recommended">Recommended</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {variant === 'auto' && (
        <div className="ai-suggest__undo hstack">
          <Check size={14} color="var(--success)" aria-hidden="true" />
          <div className="grow">
            {undoMessage && <div className="ai-suggest__undo-title">{undoMessage}</div>}
            {undoSubtext && <div className="ai-suggest__undo-sub">{undoSubtext}</div>}
          </div>
          {onUndo && (
            <Button variant="ghost" size="sm" onClick={onUndo}>
              <RotateCcw size={11} aria-hidden="true" /> Undo
            </Button>
          )}
        </div>
      )}

      {variant !== 'auto' && (onApply || onEdit || footer) && (
        <div className="ai-suggest__footer hstack">
          {footer && (
            <span className="ai-suggest__footer-note">
              <Info size={11} aria-hidden="true" /> {footer}
            </span>
          )}
          <span className="grow" />
          {onEdit && (
            <Button variant="secondary" size="sm" onClick={onEdit} disabled={loading}>
              <Edit3 size={11} aria-hidden="true" /> Edit
            </Button>
          )}
          {onApply && (
            <Button variant="ai" size="sm" onClick={onApply} disabled={loading || applyDisabled}>
              <Check size={11} aria-hidden="true" /> {loading ? 'Applying…' : applyLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
