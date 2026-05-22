import { useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui';

export function LostReasonModal({ deal, toStage, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open onClose={onCancel} labelledBy="lost-reason-title">
      <ModalHeader>
        <h2 id="lost-reason-title" style={{ margin: 0, fontSize: 16 }}>
          Move to {toStage.name}
        </h2>
      </ModalHeader>
      <ModalBody>
        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)' }}>
          {deal ? `Closing "${deal.name}" as lost.` : ''} Tell us why so the pipeline data stays useful.
        </p>
        <label className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Reason
        </label>
        <textarea
          autoFocus
          className="input"
          style={{ width: '100%', minHeight: 96, marginTop: 4 }}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Lost to competitor on pricing"
          maxLength={500}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          variant="danger"
          disabled={!reason.trim()}
          onClick={() => onConfirm(reason.trim())}
        >
          Close as lost
        </Button>
      </ModalFooter>
    </Modal>
  );
}
