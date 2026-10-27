/**
 * App-wide notifications that replace the browser's alert()/confirm().
 *
 * Works from anywhere (components, helpers like storage.js) because it talks to
 * a single <NotificationHost /> that registers itself here. With no host
 * mounted (unit tests, or before the app renders) it falls back to the
 * browser's native alert()/confirm(), so a message is never silently lost.
 */

let host = null;

/** Called by <NotificationHost />. Returns a function that unregisters it. */
export const registerNotificationHost = (impl) => {
  host = impl;
  return () => {
    if (host === impl) host = null;
  };
};

const nativeWindow = () => (typeof window !== 'undefined' ? window : globalThis);

/**
 * Shows a toast.
 * @param {string} message
 * @param {{ type?: 'error' | 'success' | 'info', title?: string }} [options]
 */
export const notify = (message, { type = 'info', title } = {}) => {
  if (host) host.notify(message, { type, title });
  else nativeWindow().alert(title ? `${title}\n\n${message}` : message);
};

/**
 * Asks the user to confirm an action. Resolves true (confirmed) or false
 * (cancelled, Escape, or clicking outside).
 * @param {string} message
 * @param {{ title?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} [options]
 *   `danger` styles the confirm button red and focuses Cancel first.
 * @returns {Promise<boolean>}
 */
export const confirmAction = (message, options = {}) =>
  host ? host.confirm(message, options) : Promise.resolve(nativeWindow().confirm(message));
