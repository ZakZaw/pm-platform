import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

export function Modal({
  open,
  onClose,
  labelledBy,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  children,
}) {
  const surfaceRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape' && closeOnEscape) onClose?.();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, closeOnEscape]);

  useEffect(() => {
    if (!open) return;
    const el = surfaceRef.current?.querySelector(
      '[data-autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    el?.focus?.();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={surfaceRef}
        className={['modal', `modal-${size}`].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalHeader({ children }) {
  return <div className="modal-header">{children}</div>;
}

export function ModalBody({ children }) {
  return <div className="modal-body">{children}</div>;
}

export function ModalFooter({ children }) {
  return <div className="modal-footer">{children}</div>;
}
