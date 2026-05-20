import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import {
  AIChip,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  useToast,
} from '@/components/ui';
import { aiApi } from '@/api/ai.api';
import { describeAiError } from './aiErrors';
import './AIDraftWizard.css';

/**
 * Asks the AI to refine an existing task: tighter description, cleaner
 * acceptance-criteria list (the UI calls these subtasks), and an optional
 * suggested points estimate. The user picks which parts to apply and the
 * caller persists them via its existing task-update plumbing.
 */
export function AITaskBreakdownModal({ open, taskId, currentTitle, onClose, onApply }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [applyDesc, setApplyDesc] = useState(true);
  const [applyAc, setApplyAc] = useState(true);
  const [applyPts, setApplyPts] = useState(true);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    setApplyDesc(true);
    setApplyAc(true);
    setApplyPts(true);
    setLoading(true);
    aiApi
      .breakdownTask(taskId)
      .then(setResult)
      .catch((err) =>
        setError(describeAiError(err, 'Could not generate a breakdown.')),
      )
      .finally(() => setLoading(false));
  }, [open, taskId]);

  function handleClose() {
    if (loading) return;
    onClose?.();
  }

  function apply() {
    if (!result) return;
    const patch = {};
    if (applyDesc && result.refinedDescription) {
      patch.description = result.refinedDescription;
    }
    if (applyAc && result.acceptanceCriteria?.length > 0) {
      patch.acceptanceCriteria = result.acceptanceCriteria;
    }
    if (applyPts && result.suggestedStoryPoints != null) {
      patch.storyPoints = result.suggestedStoryPoints;
    }
    if (Object.keys(patch).length === 0) {
      toast.show({ tone: 'info', message: 'Nothing selected to apply.' });
      return;
    }
    onApply?.(patch);
  }

  return (
    <Modal open={open} onClose={handleClose} labelledBy="ai-breakdown-title" size="lg">
      <ModalHeader>
        <AIChip label="AI" variant="gradient" />
        <h2 id="ai-breakdown-title" className="modal-title">
          Break down "{currentTitle}"
        </h2>
      </ModalHeader>
      <ModalBody>
        {error && <p className="ai-draft__error">{error}</p>}

        {loading && (
          <p className="ai-draft__empty">
            <Sparkles size={14} color="var(--ai-violet)" aria-hidden="true" />{' '}
            Asking the AI…
          </p>
        )}

        {result && !loading && (
          <>
            <div className="ai-draft__breakdown-section">
              <label className="ai-draft__breakdown-label hstack" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={applyDesc}
                  onChange={(e) => setApplyDesc(e.target.checked)}
                />
                Refined description
              </label>
              <div className="ai-draft__breakdown-text">
                {result.refinedDescription || <span className="muted">(empty)</span>}
              </div>
            </div>

            <div className="ai-draft__breakdown-section">
              <label className="ai-draft__breakdown-label hstack" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={applyAc}
                  onChange={(e) => setApplyAc(e.target.checked)}
                />
                Acceptance criteria ({result.acceptanceCriteria.length})
              </label>
              <ul className="ai-draft__breakdown-ac">
                {result.acceptanceCriteria.map((ac, i) => (
                  <li key={i}>{ac}</li>
                ))}
              </ul>
            </div>

            {result.suggestedStoryPoints != null && (
              <div className="ai-draft__breakdown-section">
                <label className="ai-draft__breakdown-label hstack" style={{ gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={applyPts}
                    onChange={(e) => setApplyPts(e.target.checked)}
                  />
                  Suggested points: {result.suggestedStoryPoints}
                </label>
              </div>
            )}

            {result.reasoning && (
              <p className="ai-draft__reasoning">{result.reasoning}</p>
            )}
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="ai" onClick={apply} disabled={loading || !result}>
          <Check size={13} aria-hidden="true" /> Apply selected
        </Button>
      </ModalFooter>
    </Modal>
  );
}
