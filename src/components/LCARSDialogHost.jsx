import './LCARSDialogHost.css';

import React, { useEffect, useRef, useState } from 'react';

import LCARSButton from './LCARSButton';
import { registerDialogHost } from '../lib/dialogs';
import useLCARSSound from '../hooks/useLCARSSound';

const TOAST_DURATION_MS = 5000;
const DEFAULT_TITLES = { info: 'NOTICE', success: 'CONFIRMED', error: 'ALERT' };

let nextId = 0;

// Renders toasts and confirm dialogs requested through src/lib/dialogs.js.
// Mounted once at the root (main.jsx).
const LCARSDialogHost = () => {
  const [toasts, setToasts] = useState([]);
  const [confirms, setConfirms] = useState([]); // queue; first one is shown
  const { playError } = useLCARSSound();

  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Keep the latest playError for the host callbacks without re-registering
  const playErrorRef = useRef(playError);
  useEffect(() => {
    playErrorRef.current = playError;
  }, [playError]);

  useEffect(
    () =>
      registerDialogHost({
        notify: (toast) => {
          const id = ++nextId;
          setToasts((prev) => [...prev, { ...toast, id }]);
          if (toast.variant === 'error') playErrorRef.current();
          else setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
        },
        confirm: (request) =>
          new Promise((resolve) => {
            setConfirms((prev) => [...prev, { ...request, id: ++nextId, resolve }]);
          }),
      }),
    [],
  );

  const activeConfirm = confirms[0];
  const answer = (confirmed) => {
    activeConfirm.resolve(confirmed);
    setConfirms((prev) => prev.slice(1));
  };

  return (
    <>
      <div className="lcars-toasts" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`lcars-toast lcars-toast-${toast.variant}`}
            role={toast.variant === 'error' ? 'alert' : 'status'}
          >
            <div className="lcars-toast-bar" />
            <div className="lcars-toast-body">
              <div className="lcars-toast-title">
                {toast.title || DEFAULT_TITLES[toast.variant]}
              </div>
              <div className="lcars-toast-message">{toast.message}</div>
            </div>
            <button
              className="lcars-toast-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {activeConfirm && (
        <ConfirmDialog key={activeConfirm.id} request={activeConfirm} onAnswer={answer} />
      )}
    </>
  );
};

function ConfirmDialog({ request, onAnswer }) {
  const { title = 'CONFIRM ACTION', message, confirmLabel, danger } = request;
  const dialogRef = useRef(null);

  // Focus the safe choice for destructive actions, and restore focus on close
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const buttons = dialogRef.current.querySelectorAll('button');
    buttons[danger ? 0 : buttons.length - 1]?.focus();
    return () => previouslyFocused?.focus?.();
  }, [danger]);

  const handleKeyDown = (e) => {
    // Stop Escape etc. from also reaching window listeners (e.g. dossier lightbox)
    e.stopPropagation();
    if (e.key === 'Escape') {
      onAnswer(false);
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog
      const buttons = [...dialogRef.current.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement);
      const next = (index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next].focus();
      e.preventDefault();
    }
  };

  return (
    <div className="lcars-dialog-overlay" onClick={() => onAnswer(false)}>
      <div
        ref={dialogRef}
        className={`lcars-dialog ${danger ? 'lcars-dialog-danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lcars-dialog-title"
        aria-describedby="lcars-dialog-message"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="lcars-dialog-header">
          <span id="lcars-dialog-title">{title}</span>
        </div>
        <div id="lcars-dialog-message" className="lcars-dialog-message">
          {message}
        </div>
        <div className="lcars-dialog-actions">
          <LCARSButton onClick={() => onAnswer(false)} color="var(--lcars-gray)" rounded="left">
            CANCEL
          </LCARSButton>
          <LCARSButton
            onClick={() => onAnswer(true)}
            color={danger ? 'var(--lcars-red)' : 'var(--lcars-orange)'}
            rounded="right"
          >
            {confirmLabel}
          </LCARSButton>
        </div>
      </div>
    </div>
  );
}

export default LCARSDialogHost;
