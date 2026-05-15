import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { ToastContext } from './ToastContext';
import './Toast.css';

const TONE_META = {
  success: { Icon: CheckCircle2, className: 'toast-success' },
  danger: { Icon: XCircle, className: 'toast-danger' },
  info: { Icon: Info, className: 'toast-info' },
};

let nextId = 0;

export function ToastProvider({ children, defaultDurationMs = 5000 }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input) => {
      const next =
        typeof input === 'string'
          ? { tone: 'info', message: input }
          : { tone: 'info', ...input };
      const id = ++nextId;
      const duration = next.duration ?? defaultDurationMs;
      setToasts((current) => [...current, { id, ...next }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [defaultDurationMs, dismiss],
  );

  useEffect(() => {
    // Clear any pending timers on unmount.
    const current = timers.current;
    return () => {
      current.forEach(clearTimeout);
      current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => {
          const meta = TONE_META[t.tone] ?? TONE_META.info;
          const { Icon, className } = meta;
          return (
            <div key={t.id} className={['toast', className].join(' ')}>
              <Icon className="toast__icon" size={18} aria-hidden="true" />
              <div className="toast__body">
                {t.title && <div className="toast__title">{t.title}</div>}
                <div className="toast__message">{t.message}</div>
              </div>
              <button
                type="button"
                className="toast__close"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
