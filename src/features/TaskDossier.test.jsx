// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase } from '../test/fakeSupabase';
import TaskDossier from './TaskDossier';

const mocks = vi.hoisted(() => ({
  supabase: {},
  uploadImages: vi.fn(),
  removeImagesByUrl: vi.fn(),
  alertUploadErrors: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({ supabase: mocks.supabase }));
vi.mock('../lib/storage', async (importActual) => ({
  ...(await importActual()),
  uploadImages: mocks.uploadImages,
  removeImagesByUrl: mocks.removeImagesByUrl,
  alertUploadErrors: mocks.alertUploadErrors,
}));
// The real hook needs a SoundProvider; sounds aren't under test here
vi.mock('../hooks/useLCARSSound', () => ({
  default: () => ({ playClick: vi.fn(), playError: vi.fn(), playEngage: vi.fn() }),
}));

const AUTOSAVE_MS = 700;
const IMAGE_URL = 'https://abc.supabase.co/storage/v1/object/public/task-images/user-1/tasks/t1/a.png';

const makeTask = (overrides = {}) => ({
  id: 't1',
  text: 'Repair warp core',
  details: 'initial protocol',
  images: [],
  dueDate: null,
  ...overrides,
});

const renderDossier = ({ task = makeTask(), onUpdate = vi.fn().mockResolvedValue(true) } = {}) => {
  const onClose = vi.fn();
  const utils = render(<TaskDossier task={task} onClose={onClose} onUpdate={onUpdate} />);
  return { ...utils, onUpdate, onClose };
};

const typeProtocol = (value) =>
  fireEvent.change(screen.getByPlaceholderText(/ENTER MISSION PROTOCOLS/), { target: { value } });

const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('TaskDossier autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(mocks.supabase, createFakeSupabase(() => ({ data: [], error: null })));
    mocks.uploadImages.mockReset();
    mocks.removeImagesByUrl.mockReset();
    mocks.alertUploadErrors.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not save until typing pauses for the debounce delay', async () => {
    const { onUpdate } = renderDossier();
    await advance(0); // let the initial personnel fetch settle

    typeProtocol('new protocol');
    await advance(AUTOSAVE_MS - 1);
    expect(onUpdate).not.toHaveBeenCalled();

    await advance(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('t1', { details: 'new protocol', images: [] });
  });

  it('collapses rapid edits into one save with the latest text', async () => {
    const { onUpdate } = renderDossier();
    await advance(0);

    typeProtocol('a');
    await advance(300);
    typeProtocol('ab');
    await advance(300);
    typeProtocol('abc');
    await advance(AUTOSAVE_MS);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('t1', { details: 'abc', images: [] });
  });

  it('does not save when nothing changed, or when an edit is reverted before saving', async () => {
    const { onUpdate } = renderDossier();
    await advance(0);

    await advance(AUTOSAVE_MS * 2);
    typeProtocol('changed');
    typeProtocol('initial protocol');
    await advance(AUTOSAVE_MS * 2);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('flushes unsaved edits immediately when the dossier closes', async () => {
    const { onUpdate, unmount } = renderDossier();
    await advance(0);

    typeProtocol('written just before closing');
    expect(onUpdate).not.toHaveBeenCalled();

    unmount();
    expect(onUpdate).toHaveBeenCalledWith('t1', {
      details: 'written just before closing',
      images: [],
    });
  });

  it('keeps a failed save pending and retries it when the dossier closes', async () => {
    const onUpdate = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { unmount } = renderDossier({ onUpdate });
    await advance(0);

    typeProtocol('important edit');
    await advance(AUTOSAVE_MS);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    unmount();
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith('t1', { details: 'important edit', images: [] });
  });

  it('does not re-save after a successful save when the dossier closes', async () => {
    const { onUpdate, unmount } = renderDossier();
    await advance(0);

    typeProtocol('saved already');
    await advance(AUTOSAVE_MS);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    unmount();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('TaskDossier images', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(mocks.supabase, createFakeSupabase(() => ({ data: [], error: null })));
    mocks.uploadImages.mockReset();
    mocks.removeImagesByUrl.mockReset();
    mocks.alertUploadErrors.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes a removed image from storage only after the save succeeds', async () => {
    const { onUpdate } = renderDossier({ task: makeTask({ images: [IMAGE_URL] }) });
    await advance(0);

    fireEvent.click(screen.getByText('VISUALS'));
    fireEvent.click(screen.getByText('X'));
    expect(mocks.removeImagesByUrl).not.toHaveBeenCalled();

    await advance(AUTOSAVE_MS);
    expect(onUpdate).toHaveBeenCalledWith('t1', { details: 'initial protocol', images: [] });
    expect(mocks.removeImagesByUrl).toHaveBeenCalledWith([IMAGE_URL]);
  });

  it('keeps the file in storage when the save fails', async () => {
    const onUpdate = vi.fn().mockResolvedValue(false);
    renderDossier({ task: makeTask({ images: [IMAGE_URL] }), onUpdate });
    await advance(0);

    fireEvent.click(screen.getByText('VISUALS'));
    fireEvent.click(screen.getByText('X'));
    await advance(AUTOSAVE_MS);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.removeImagesByUrl).not.toHaveBeenCalled();
  });

  it('adds uploaded images to the task and saves them', async () => {
    const newUrl = 'https://abc.supabase.co/storage/v1/object/public/task-images/user-1/tasks/t1/b.png';
    mocks.uploadImages.mockResolvedValue({ urls: [newUrl], errors: [] });
    const { container, onUpdate } = renderDossier();
    await advance(0);

    fireEvent.click(screen.getByText('VISUALS'));
    const file = new File(['x'], 'b.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [file] } });
    });
    await advance(AUTOSAVE_MS);

    expect(mocks.uploadImages).toHaveBeenCalledWith([file], 'tasks/t1');
    expect(onUpdate).toHaveBeenCalledWith('t1', { details: 'initial protocol', images: [newUrl] });
  });

  it('discards files whose upload finishes after the dossier was closed', async () => {
    const lateUrl = 'https://abc.supabase.co/storage/v1/object/public/task-images/user-1/tasks/t1/late.png';
    let finishUpload;
    mocks.uploadImages.mockReturnValue(new Promise((resolve) => { finishUpload = resolve; }));
    const { container, onUpdate, unmount } = renderDossier();
    await advance(0);

    fireEvent.click(screen.getByText('VISUALS'));
    fireEvent.change(container.querySelector('input[type=file]'), {
      target: { files: [new File(['x'], 'late.png', { type: 'image/png' })] },
    });
    unmount();

    await act(async () => { finishUpload({ urls: [lateUrl], errors: [] }); });

    expect(mocks.removeImagesByUrl).toHaveBeenCalledWith([lateUrl]);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
