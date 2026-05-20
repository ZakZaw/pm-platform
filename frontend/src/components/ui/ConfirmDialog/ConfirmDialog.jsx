import { useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../Button/Button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../Modal/Modal';
import './ConfirmDialog.css';

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();

  return (
    <Modal open={open} onClose={busy ? undefined : onCancel} labelledBy={titleId} size="sm">
      <ModalHeader>
        <span className={['confirm-dialog__icon', `confirm-dialog__icon-${tone}`].join(' ')}>
          <AlertTriangle size={16} aria-hidden="true" />
        </span>
        <h2 id={titleId} className="modal-title confirm-dialog__title">
          {title}
        </h2>
      </ModalHeader>
      {message && (
        <ModalBody>
          <p className="confirm-dialog__message">{message}</p>
        </ModalBody>
      )}
      <ModalFooter>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === 'warning' ? 'primary' : 'danger'}
          onClick={onConfirm}
          disabled={busy}
          data-autofocus
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
