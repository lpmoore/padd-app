// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase } from '../test/fakeSupabase';
import NotificationHost from '../components/NotificationHost';
import Library from './Library';

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

const BUCKET_URL = 'https://abc.supabase.co/storage/v1/object/public/task-images/user-1/library/i1';
const SAVED_A = `${BUCKET_URL}/saved-a.png`;
const SAVED_B = `${BUCKET_URL}/saved-b.png`;
const UPLOADED = `${BUCKET_URL}/uploaded.png`;

const ITEM = {
  id: 'i1',
  category: 'SHIPS',
  title: 'USS TEST',
  subtitle: 'Test Class',
  details: { crew: '10' },
  description: 'A ship for testing.',
  images: [SAVED_A, SAVED_B],
};

let fake;
let updateResult;

const imageFile = (name = 'new.png') => new File(['x'], name, { type: 'image/png' });
const thumbs = (container) => [...container.querySelectorAll('.note-visual-thumb')];

const renderLibrary = async () => {
  const utils = render(<Library />);
  await screen.findByRole('heading', { name: 'USS TEST' });
  // The signed-in session loads separately and reveals the EDIT button
  await screen.findByText('EDIT');
  return utils;
};

const startEditing = async () => {
  fireEvent.click(screen.getByText('EDIT'));
  await screen.findByText('EDITING RECORD');
};

const uploadDuringEdit = async (container, urls = [UPLOADED]) => {
  mocks.uploadImages.mockResolvedValue({ urls, errors: [] });
  await act(async () => {
    fireEvent.change(container.querySelector('input[type=file]'), {
      target: { files: [imageFile()] },
    });
  });
};

/** Selects the thumbnail at `index` and confirms removal, as a user would */
const removeThumb = async (container, index) => {
  fireEvent.click(thumbs(container)[index]);
  // Confirming goes through an async dialog (or the native fallback), so wait for it
  await act(async () => { fireEvent.click(screen.getByText(/REMOVE SELECTED/)); });
};

describe('Library edit / cancel / save image handling', () => {
  beforeEach(() => {
    updateResult = { error: null };
    fake = createFakeSupabase(({ table, op, args }) => {
      if (table !== 'library_items') return { data: [], error: null };
      if (op === 'update') return updateResult;
      if (op === 'select' && args[0] === 'category') return { data: [{ category: 'SHIPS' }], error: null };
      return { data: [ITEM], error: null };
    });
    Object.assign(mocks.supabase, fake);
    mocks.uploadImages.mockReset();
    mocks.removeImagesByUrl.mockReset();
    mocks.alertUploadErrors.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('shows the selected record and starts editing with its saved images', async () => {
    const { container } = await renderLibrary();
    await startEditing();
    expect(thumbs(container)).toHaveLength(2);
  });

  it('deletes files uploaded during an edit when the edit is cancelled', async () => {
    const { container } = await renderLibrary();
    await startEditing();
    await uploadDuringEdit(container);
    expect(thumbs(container)).toHaveLength(3);

    fireEvent.click(screen.getByText('CANCEL'));

    expect(mocks.removeImagesByUrl).toHaveBeenCalledWith([UPLOADED]);
    expect(fake.queries.some((q) => q.op === 'update')).toBe(false);
  });

  it('discards an upload that finishes after the edit was cancelled', async () => {
    let finishUpload;
    mocks.uploadImages.mockReturnValue(new Promise((resolve) => { finishUpload = resolve; }));
    const { container } = await renderLibrary();
    await startEditing();
    fireEvent.change(container.querySelector('input[type=file]'), {
      target: { files: [imageFile()] },
    });

    fireEvent.click(screen.getByText('CANCEL'));
    await act(async () => { finishUpload({ urls: [UPLOADED], errors: [] }); });

    expect(mocks.removeImagesByUrl).toHaveBeenCalledWith([UPLOADED]);
  });

  it('does not touch storage for a saved image removed during an edit that is then cancelled', async () => {
    const { container } = await renderLibrary();
    await startEditing();
    await removeThumb(container, 0);
    expect(thumbs(container)).toHaveLength(1);
    expect(mocks.removeImagesByUrl).not.toHaveBeenCalledWith([SAVED_A]);

    fireEvent.click(screen.getByText('CANCEL'));

    // Nothing was saved, so the record still references the file: it must survive
    const deleted = mocks.removeImagesByUrl.mock.calls.flatMap(([urls]) => urls);
    expect(deleted).not.toContain(SAVED_A);
    expect(fake.queries.some((q) => q.op === 'update')).toBe(false);
  });

  it('restores saved images after cancelling and editing again', async () => {
    const { container } = await renderLibrary();
    await startEditing();
    await removeThumb(container, 0);
    fireEvent.click(screen.getByText('CANCEL'));

    await startEditing();
    expect(thumbs(container)).toHaveLength(2);
  });

  it('deletes a removed saved image only after the record saves successfully', async () => {
    const { container } = await renderLibrary();
    await startEditing();
    await removeThumb(container, 0);
    expect(mocks.removeImagesByUrl).not.toHaveBeenCalledWith([SAVED_A]);

    await act(async () => { fireEvent.click(screen.getByText('SAVE')); });

    const update = fake.queries.find((q) => q.op === 'update');
    expect(update.args[0].images).toEqual([SAVED_B]);
    expect(mocks.removeImagesByUrl).toHaveBeenCalledWith([SAVED_A]);
  });

  it('keeps removed images in storage and alerts when the save fails', async () => {
    updateResult = { error: { message: 'boom' } };
    const { container } = await renderLibrary();
    await startEditing();
    await removeThumb(container, 0);

    await act(async () => { fireEvent.click(screen.getByText('SAVE')); });

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Could not save record: boom'));
    const deleted = mocks.removeImagesByUrl.mock.calls.flatMap(([urls]) => urls);
    expect(deleted).not.toContain(SAVED_A);
    // Still editing, so the user can retry
    expect(screen.getByText('EDITING RECORD')).toBeInTheDocument();
  });

  it('deletes an image uploaded during this edit immediately when it is removed again', async () => {
    const { container } = await renderLibrary();
    await startEditing();
    await uploadDuringEdit(container);

    await removeThumb(container, 2);

    expect(mocks.removeImagesByUrl).toHaveBeenCalledWith([UPLOADED]);
    expect(thumbs(container)).toHaveLength(2);

    // ...and it is not deleted a second time when the edit is cancelled
    mocks.removeImagesByUrl.mockClear();
    fireEvent.click(screen.getByText('CANCEL'));
    const deletedAfterCancel = mocks.removeImagesByUrl.mock.calls.flatMap(([urls]) => urls);
    expect(deletedAfterCancel).not.toContain(UPLOADED);
  });

  it('deletes all of a record\'s images when the record is deleted', async () => {
    await renderLibrary();

    await act(async () => { fireEvent.click(screen.getByText('DELETE')); });

    expect(fake.queries.some((q) => q.op === 'delete' && q.table === 'library_items')).toBe(true);
    expect(mocks.removeImagesByUrl).toHaveBeenCalledWith([SAVED_A, SAVED_B]);
  });

  it('keeps a record\'s images when deleting the record fails', async () => {
    fake = createFakeSupabase(({ table, op, args }) => {
      if (table !== 'library_items') return { data: [], error: null };
      if (op === 'delete') return { error: { message: 'nope' } };
      if (op === 'select' && args[0] === 'category') return { data: [{ category: 'SHIPS' }], error: null };
      return { data: [ITEM], error: null };
    });
    Object.assign(mocks.supabase, fake);
    await renderLibrary();

    await act(async () => { fireEvent.click(screen.getByText('DELETE')); });

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Could not delete record: nope'));
    expect(mocks.removeImagesByUrl).not.toHaveBeenCalled();
  });

  describe('with the in-app toast and dialog host mounted', () => {
    const renderWithHost = async () => {
      const utils = render(<><Library /><NotificationHost /></>);
      await screen.findByRole('heading', { name: 'USS TEST' });
      await screen.findByText('EDIT');
      return utils;
    };

    it('shows an error toast instead of a browser alert when saving fails', async () => {
      updateResult = { error: { message: 'boom' } };
      await renderWithHost();
      await startEditing();

      await act(async () => { fireEvent.click(screen.getByText('SAVE')); });

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save record: boom');
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('asks in an in-app dialog before deleting, and does nothing when cancelled', async () => {
      await renderWithHost();

      fireEvent.click(screen.getByText('DELETE'));
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent('Delete record "USS TEST" and its images?');
      expect(window.confirm).not.toHaveBeenCalled();

      await act(async () => { fireEvent.click(screen.getByText('CANCEL')); });

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(fake.queries.some((q) => q.op === 'delete')).toBe(false);
      expect(mocks.removeImagesByUrl).not.toHaveBeenCalled();
    });

    it('deletes the record and its images once the dialog is confirmed', async () => {
      await renderWithHost();

      fireEvent.click(screen.getByText('DELETE'));
      await screen.findByRole('alertdialog');
      await act(async () => {
        fireEvent.click(screen.getAllByText('DELETE').find((el) => el.closest('[role=alertdialog]')));
      });

      expect(fake.queries.some((q) => q.op === 'delete' && q.table === 'library_items')).toBe(true);
      expect(mocks.removeImagesByUrl).toHaveBeenCalledWith([SAVED_A, SAVED_B]);
    });
  });
});
