import { useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui';
import './LostReasonModal.css';

export function LostReasonModal({ deal, toStage, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open onClose={onCancel} labelledBy="lost-reason-title">
      <ModalHeader>
        <h2 id="lost-reason-title" className="modal-title">
          Move to {toStage.name}
        </h2>
      </ModalHeader>
      <ModalBody>
        <p className="lost-reason-lead">
          {deal ? `Closing "${deal.name}" as lost.` : ''} Tell us why so the pipeline data stays useful.
        </p>
        <label className="input-label" htmlFor="lost-reason-input">
          Reason
        </label>
        <textarea
          id="lost-reason-input"
          autoFocus
          className="textarea"
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
