import { afterEach, describe, expect, it, vi } from 'vitest';

import { confirmAction, notify, registerNotificationHost } from './notify';

const nativeAlert = vi.fn();
const nativeConfirm = vi.fn();
vi.stubGlobal('alert', nativeAlert);
vi.stubGlobal('confirm', nativeConfirm);

afterEach(() => {
  nativeAlert.mockReset();
  nativeConfirm.mockReset();
});

describe('without a notification host', () => {
  it('falls back to the native alert so a message is never lost', () => {
    notify('Something broke', { type: 'error' });
    expect(nativeAlert).toHaveBeenCalledWith('Something broke');
  });

  it('includes the title in the native alert', () => {
    notify('2 files failed', { title: 'UPLOAD FAILED' });
    expect(nativeAlert).toHaveBeenCalledWith('UPLOAD FAILED\n\n2 files failed');
  });

  it('falls back to the native confirm and resolves with its answer', async () => {
    nativeConfirm.mockReturnValue(true);
    await expect(confirmAction('Delete it?')).resolves.toBe(true);
    nativeConfirm.mockReturnValue(false);
    await expect(confirmAction('Delete it?')).resolves.toBe(false);
  });
});

describe('with a notification host', () => {
  it('routes to the host and not to the native dialogs', async () => {
    const host = { notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) };
    const unregister = registerNotificationHost(host);

    notify('Saved', { type: 'success', title: 'DONE' });
    const confirmed = await confirmAction('Sure?', { danger: true });
    unregister();

    expect(host.notify).toHaveBeenCalledWith('Saved', { type: 'success', title: 'DONE' });
    expect(host.confirm).toHaveBeenCalledWith('Sure?', { danger: true });
    expect(confirmed).toBe(true);
    expect(nativeAlert).not.toHaveBeenCalled();
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it('defaults to an info toast', () => {
    const host = { notify: vi.fn(), confirm: vi.fn() };
    const unregister = registerNotificationHost(host);
    notify('FYI');
    unregister();
    expect(host.notify).toHaveBeenCalledWith('FYI', { type: 'info', title: undefined });
  });

  it('goes back to the native fallback after the host unregisters', () => {
    const unregister = registerNotificationHost({ notify: vi.fn(), confirm: vi.fn() });
    unregister();
    notify('Hello');
    expect(nativeAlert).toHaveBeenCalledWith('Hello');
  });

  it('a stale unregister does not remove a newer host', () => {
    const first = { notify: vi.fn(), confirm: vi.fn() };
    const second = { notify: vi.fn(), confirm: vi.fn() };
    const unregisterFirst = registerNotificationHost(first);
    const unregisterSecond = registerNotificationHost(second);

    unregisterFirst(); // e.g. React StrictMode tearing down the first mount
    notify('Still routed');
    unregisterSecond();

    expect(second.notify).toHaveBeenCalled();
    expect(first.notify).not.toHaveBeenCalled();
  });
});
