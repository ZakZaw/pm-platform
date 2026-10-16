import { findProjectType } from '@/constants/projectTypes';

// F1.5-08 / F1.5-07 — AI-inbox presentation registry, keyed by project type.
// Each suggestion card carries `projectType`; this registry is the only place
// that decides how a type looks in the inbox (tone + icon + label), so the
// inbox pages never branch on type. Adding a project type = one line here.
//
// Tones are token families (`--info`, `--success`, `--rose`, …) consumed by
// the AISuggestionCard `tone` prop and the SuggestionTypeBadge.
export const SUGGESTION_TYPE_TONES = {
  Engineering: 'info',
  Sales: 'success',
  Support: 'rose',
  Marketing: 'amber',
  Operations: 'violet',
  Generic: 'neutral',
};

/**
 * @param {string | null | undefined} projectType
 * @returns {{ id: string, label: string, short: string, icon: any, tone: string }}
 */
export function suggestionTypeMeta(projectType) {
  const meta = findProjectType(projectType);
  return {
    id: meta.id,
    label: meta.label,
    short: meta.short,
    icon: meta.icon,
    tone: SUGGESTION_TYPE_TONES[projectType] ?? 'neutral',
  };
}

// F2-12 — short labels for the three replan options, surfaced both in
// the option list and the success toast on apply.
export const REPLAN_OPTION_LABELS = {
  CutScope: 'Cut scope',
  AddResource: 'Add resource',
  ShiftMilestone: 'Shift milestone',
};

/**
 * Server derives `category` from the suggestion kind (SuggestionInbox.CategoryFor);
 * older payloads without it fall back to "Other".
 * @param {{ category?: string }} s
 */
export function suggestionCategory(s) {
  return s?.category || 'Other';
}
