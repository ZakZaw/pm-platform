import { suggestionTypeMeta } from './suggestionTypes';
import './SuggestionList.css';

/**
 * F1.5-08 — project-type tag for AI suggestion cards and inbox group
 * headings: round tinted icon + coloured label, toned per the
 * suggestionTypes registry.
 * @param {{ projectType: string, label?: string, size?: 'sm' | 'md' }} props
 */
export function SuggestionTypeBadge({ projectType, label, size = 'sm' }) {
  const meta = suggestionTypeMeta(projectType);
  const TypeIcon = meta.icon;
  return (
    <span className={`ai-type-badge is-${meta.tone} is-${size}`}>
      <span className="ai-type-badge-icon" aria-hidden="true">
        {TypeIcon && <TypeIcon size={size === 'md' ? 14 : 11} />}
      </span>
      <span className="ai-type-badge-label">{label ?? meta.label}</span>
    </span>
  );
}
