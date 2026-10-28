import { afterEach, describe, expect, it, vi } from 'vitest';

import { confirmAction, notify, notifyError, registerDialogHost } from './dialogs';

describe('dialogs', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to the browser dialogs when no host is mounted', async () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    vi.stubGlobal('confirm', vi.fn(() => true));

    notifyError('SAVE FAILED', 'Network down');
    expect(alert).toHaveBeenCalledWith('SAVE FAILED\n\nNetwork down');
    await expect(confirmAction('Delete?')).resolves.toBe(true);
  });

  it('routes to the registered host with defaults filled in', async () => {
    const host = { notify: vi.fn(), confirm: vi.fn(() => Promise.resolve(false)) };
    const unregister = registerDialogHost(host);

    notify('Saved');
    expect(host.notify).toHaveBeenCalledWith({ message: 'Saved', title: undefined, variant: 'info' });

    await expect(confirmAction('Delete?', { danger: true })).resolves.toBe(false);
    expect(host.confirm).toHaveBeenCalledWith({
      message: 'Delete?',
      title: undefined,
      confirmLabel: 'CONFIRM',
      danger: true,
    });

    unregister();
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    notify('After unmount');
    expect(alert).toHaveBeenCalledWith('After unmount');
  });

  it('ignores a stale unregister after a newer host registered', () => {
    const first = { notify: vi.fn() };
    const second = { notify: vi.fn() };
    const unregisterFirst = registerDialogHost(first);
    const unregisterSecond = registerDialogHost(second);

    unregisterFirst();
    notify('Hello');
    expect(second.notify).toHaveBeenCalled();
    unregisterSecond();
  });
});
