import { useCallback, useEffect, useRef, useState } from 'react';

import { registerNotificationHost } from '../lib/notify';
import './NotificationHost.css';

const MAX_TOASTS = 4;
const DURATION_MS = { error: 9000, success: 4000, info: 5000 };
const DEFAULT_TITLES = { error: 'ERROR', success: 'SUCCESS', info: 'NOTICE' };

const ConfirmDialog = ({ dialog, onResolve }) => {
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const { id, message, title = 'CONFIRM ACTION', confirmLabel = 'CONFIRM', cancelLabel = 'CANCEL', danger = false } = dialog;

  // Focus the safe choice for destructive actions, and give focus back afterwards
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    (danger ? cancelRef : confirmRef).current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [danger]);

  // Capture phase so Escape closes only this dialog, not a dossier or lightbox behind it
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onResolve(false);
      } else if (e.key === 'Tab') {
        // Keep keyboard focus inside the dialog
        const buttons = [...dialogRef.current.querySelectorAll('button')];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onResolve]);

  return (
    <div className="notify-backdrop" onClick={() => onResolve(false)}>
      <div
        ref={dialogRef}
        className={`notify-dialog${danger ? ' danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`notify-dialog-title-${id}`}
        aria-describedby={`notify-dialog-message-${id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div id={`notify-dialog-title-${id}`} className="notify-dialog-title">{title}</div>
        <p id={`notify-dialog-message-${id}`} className="notify-dialog-message">{message}</p>
        <div className="notify-dialog-actions">
          <button ref={cancelRef} type="button" className="notify-btn cancel" onClick={() => onResolve(false)}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} type="button" className="notify-btn confirm" onClick={() => onResolve(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Renders toasts and confirmation dialogs for the whole app. Mount once, near
 * the root. Other code uses `notify` / `confirmAction` from `lib/notify.js`.
 */
const NotificationHost = () => {
  const [toasts, setToasts] = useState([]);
  const [dialogs, setDialogs] = useState([]); // queue; the first one is shown
  const nextId = useRef(0);
  const timers = useRef(new Map());
  const openDialogs = useRef([]);

  useEffect(() => {
    openDialogs.current = dialogs;
  }, [dialogs]);

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const pendingTimers = timers.current;
    const host = {
      notify: (message, { type, title }) => {
        const id = ++nextId.current;
        setToasts((prev) => [...prev, { id, message, type, title: title ?? DEFAULT_TITLES[type] }].slice(-MAX_TOASTS));
        pendingTimers.set(id, setTimeout(() => dismissToast(id), DURATION_MS[type] ?? DURATION_MS.info));
      },
      confirm: (message, options) =>
        new Promise((resolve) => {
          setDialogs((prev) => [...prev, { id: ++nextId.current, message, resolve, ...options }]);
        }),
    };
    const unregister = registerNotificationHost(host);
    return () => {
      unregister();
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
      // Never leave a caller waiting forever
      openDialogs.current.forEach((d) => d.resolve(false));
    };
  }, [dismissToast]);

  const resolveDialog = useCallback((dialog, result) => {
    dialog.resolve(result);
    setDialogs((prev) => prev.filter((d) => d.id !== dialog.id));
  }, []);

  const activeDialog = dialogs[0];

  return (
    <>
      {toasts.length > 0 && (
        <div className="notify-toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`notify-toast ${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
              <div className="notify-toast-cap" />
              <div className="notify-toast-body">
                <div className="notify-toast-title">{t.title}</div>
                <div className="notify-toast-message">{t.message}</div>
              </div>
              <button type="button" className="notify-toast-close" aria-label="Dismiss notification" onClick={() => dismissToast(t.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {activeDialog && (
        <ConfirmDialog key={activeDialog.id} dialog={activeDialog} onResolve={(result) => resolveDialog(activeDialog, result)} />
      )}
    </>
  );
};

export default NotificationHost;
