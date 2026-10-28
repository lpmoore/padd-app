// LCARS replacements for window.alert / window.confirm, callable from
// anywhere (components and plain modules like storage.js). <LCARSDialogHost>
// registers itself on mount; until then these fall back to the browser's.

let host = null;

/** Called by LCARSDialogHost. Returns an unregister function. */
export const registerDialogHost = (nextHost) => {
  host = nextHost;
  return () => {
    if (host === nextHost) host = null;
  };
};

/**
 * Shows a toast. Errors stay until dismissed; other variants fade out.
 * @param {string} message
 * @param {{ title?: string, variant?: 'info' | 'success' | 'error' }} [options]
 */
export const notify = (message, { title, variant = 'info' } = {}) => {
  if (host) host.notify({ message, title, variant });
  else alert(title ? `${title}\n\n${message}` : message);
};

export const notifyError = (title, message) => notify(message, { title, variant: 'error' });

/**
 * Asks the user to confirm an action.
 * @param {string} message
 * @param {{ title?: string, confirmLabel?: string, danger?: boolean }} [options]
 * @returns {Promise<boolean>} true if confirmed
 */
export const confirmAction = (message, { title, confirmLabel = 'CONFIRM', danger = false } = {}) => {
  if (host) return host.confirm({ message, title, confirmLabel, danger });
  return Promise.resolve(confirm(message));
};
