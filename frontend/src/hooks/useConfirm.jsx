import { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';

const DEFAULTS = {
  title: 'Are you sure?',
  message: null,
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  tone: 'danger',
};

/**
 * Promise-based confirm dialog. Use:
 *
 *   const { confirm, dialog } = useConfirm();
 *   const ok = await confirm({ title, message, confirmLabel, tone });
 *   if (!ok) return;
 *
 * Render `{dialog}` once at the bottom of your component.
 */
export function useConfirm() {
  const [state, setState] = useState({ open: false, opts: DEFAULTS, busy: false });
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, opts: { ...DEFAULTS, ...opts }, busy: false });
    });
  }, []);

  const close = useCallback((result) => {
    setState((s) => ({ ...s, open: false, busy: false }));
    const r = resolverRef.current;
    resolverRef.current = null;
    r?.(result);
  }, []);

  const handleConfirm = useCallback(() => {
    setState((s) => ({ ...s, busy: true }));
    // We close optimistically; callers needing async work can await the
    // returned promise and run the action themselves. The busy state is
    // transient: we flip it on so the button shows "Working…" for a
    // beat before the modal unmounts.
    close(true);
  }, [close]);

  const handleCancel = useCallback(() => close(false), [close]);

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.opts.title}
      message={state.opts.message}
      confirmLabel={state.opts.confirmLabel}
      cancelLabel={state.opts.cancelLabel}
      tone={state.opts.tone}
      busy={state.busy}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, dialog };
}
