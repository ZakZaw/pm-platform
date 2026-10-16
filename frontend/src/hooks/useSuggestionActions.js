import { useMemo } from 'react';
import { useToast } from '@/components/ui';
import { aiApi } from '@/api/ai.api';
import { describeAiError } from '@/components/ai/aiErrors';
import { REPLAN_OPTION_LABELS } from '@/components/ai/suggestionTypes';

/**
 * Accept / dismiss / apply handlers for AI-inbox cards, shared by the
 * project inbox and the org inbox (F1.5-08). On success each handler calls
 * `onResolved(suggestion)` so the caller can drop the card from its list.
 *
 * @param {(suggestion: { id: string }) => void} onResolved
 */
export function useSuggestionActions(onResolved) {
  const toast = useToast();

  return useMemo(() => ({
    async dismiss(suggestion) {
      try {
        await aiApi.dismissSuggestion(suggestion.id);
        onResolved(suggestion);
      } catch (err) {
        toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not dismiss.' });
      }
    },

    async accept(suggestion) {
      try {
        await aiApi.acceptSuggestion(suggestion.id);
        onResolved(suggestion);
        toast.show({ tone: 'success', message: 'Suggestion accepted.' });
      } catch (err) {
        toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not accept.' });
      }
    },

    // F2-12 — apply one of the three replan options. On success the card
    // flips to Accepted server-side.
    async applyReplan(suggestion, optionKey) {
      try {
        await aiApi.applyVelocityReplan(suggestion.id, optionKey);
        onResolved(suggestion);
        toast.show({
          tone: 'success',
          message: `Applied ${REPLAN_OPTION_LABELS[optionKey] ?? 'replan'}.`,
        });
      } catch (err) {
        toast.show({ tone: 'danger', message: describeAiError(err, 'Could not apply replan.') });
      }
    },

    // F2-13 — bulk-accept (picks = []) or override per row. Server
    // normalises an empty picks array to "use defaults".
    async applyReassignments(suggestion, picks) {
      try {
        const updated = await aiApi.applyReassignments(suggestion.id,
          picks && picks.length > 0 ? picks : null);
        onResolved(suggestion);
        toast.show({
          tone: 'success',
          message: `Reassigned ${picks?.length ? `${picks.length} task${picks.length === 1 ? '' : 's'}` : 'tasks'}.`,
        });
        return updated;
      } catch (err) {
        toast.show({ tone: 'danger', message: describeAiError(err, 'Could not apply reassignments.') });
        throw err;
      }
    },
  }), [onResolved, toast]);
}
