// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { confirmAction, notify } from '../lib/notify';
import NotificationHost from './NotificationHost';

describe('toasts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(<NotificationHost />);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast with a default title for its type', () => {
    act(() => notify('Task saved', { type: 'success' }));
    expect(screen.getByRole('status')).toHaveTextContent('SUCCESS');
    expect(screen.getByRole('status')).toHaveTextContent('Task saved');
  });

  it('announces errors as alerts so screen readers read them immediately', () => {
    act(() => notify('Could not delete', { type: 'error' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete');
  });

  it('uses a custom title when given', () => {
    act(() => notify('2 of 3 failed', { type: 'error', title: 'IMAGE DELETE FAILED' }));
    expect(screen.getByRole('alert')).toHaveTextContent('IMAGE DELETE FAILED');
  });

  it('dismisses itself after a few seconds, errors staying longer than successes', () => {
    act(() => {
      notify('ok', { type: 'success' });
      notify('bad', { type: 'error' });
    });

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('ok')).not.toBeInTheDocument();
    expect(screen.getByText('bad')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('bad')).not.toBeInTheDocument();
  });

  it('can be dismissed by hand', () => {
    act(() => notify('Dismiss me'));
    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  it('keeps only the four newest toasts so they cannot pile up', () => {
    act(() => {
      for (let i = 1; i <= 6; i += 1) notify(`message ${i}`);
    });
    expect(screen.queryByText('message 2')).not.toBeInTheDocument();
    expect(screen.getByText('message 3')).toBeInTheDocument();
    expect(screen.getByText('message 6')).toBeInTheDocument();
  });
});

describe('confirmation dialog', () => {
  let host;

  beforeEach(() => {
    host = render(<NotificationHost />);
  });

  it('resolves true when confirmed', async () => {
    let result;
    act(() => { result = confirmAction('Proceed?', { title: 'CHECK' }); });

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('CHECK');
    expect(dialog).toHaveTextContent('Proceed?');

    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM' }));
    await expect(result).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('resolves false when cancelled', async () => {
    let result;
    act(() => { result = confirmAction('Proceed?'); });
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    await expect(result).resolves.toBe(false);
  });

  it('resolves false on Escape, without the key reaching other handlers', async () => {
    const outside = vi.fn();
    window.addEventListener('keydown', outside);
    let result;
    act(() => { result = confirmAction('Proceed?'); });

    fireEvent.keyDown(document.body, { key: 'Escape' });

    await expect(result).resolves.toBe(false);
    expect(outside).not.toHaveBeenCalled();
    window.removeEventListener('keydown', outside);
  });

  it('resolves false when the backdrop is clicked, but not when the dialog itself is', async () => {
    let result;
    act(() => { result = confirmAction('Proceed?'); });

    fireEvent.click(screen.getByRole('alertdialog'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('alertdialog').parentElement);
    await expect(result).resolves.toBe(false);
  });

  it('focuses Cancel for dangerous actions and Confirm otherwise', () => {
    act(() => { confirmAction('Delete everything?', { danger: true, confirmLabel: 'DELETE' }); });
    expect(screen.getByRole('button', { name: 'CANCEL' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'DELETE' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));

    act(() => { confirmAction('Harmless?'); });
    expect(screen.getByRole('button', { name: 'CONFIRM' })).toHaveFocus();
  });

  it('keeps Tab focus inside the dialog', () => {
    act(() => { confirmAction('Proceed?'); });
    const cancel = screen.getByRole('button', { name: 'CANCEL' });
    const confirm = screen.getByRole('button', { name: 'CONFIRM' });

    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
  });

  it('shows queued dialogs one at a time, in order', async () => {
    let first;
    let second;
    act(() => {
      first = confirmAction('First?');
      second = confirmAction('Second?');
    });

    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('First?');

    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    await expect(first).resolves.toBe(false);

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Second?');
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRM' }));
    await expect(second).resolves.toBe(true);
  });

  it('resolves a pending dialog as cancelled if the host unmounts', async () => {
    let result;
    act(() => { result = confirmAction('Proceed?'); });

    host.unmount();

    await expect(result).resolves.toBe(false);
  });
});
