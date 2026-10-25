import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  imagesNoLongerUsed,
  isSupportedImage,
  removeImagesByUrl,
  storagePathFromUrl,
  uploadImage,
} from './storage';

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock('./supabase', () => ({
  supabase: { storage: { from: () => ({ remove }) } },
}));

const BASE = 'https://abc.supabase.co/storage/v1/object/public/task-images';

describe('storagePathFromUrl', () => {
  it('extracts the path from a bucket public URL', () => {
    expect(storagePathFromUrl(`${BASE}/uid-1/tasks/42/123-x.png`)).toBe(
      'uid-1/tasks/42/123-x.png',
    );
  });

  it('decodes URL-encoded paths (legacy uploads kept original file names)', () => {
    expect(storagePathFromUrl(`${BASE}/library/7/1_my%20photo.jpg`)).toBe(
      'library/7/1_my photo.jpg',
    );
  });

  it('ignores external URLs and other buckets', () => {
    expect(storagePathFromUrl('https://example.com/task-images/x.png')).toBeNull();
    expect(
      storagePathFromUrl('https://abc.supabase.co/storage/v1/object/public/other/x.png'),
    ).toBeNull();
  });
});

describe('isSupportedImage', () => {
  it('accepts common web image types only', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
      expect(isSupportedImage({ type })).toBe(true);
    }
    for (const type of ['image/svg+xml', 'text/html', 'application/pdf', '']) {
      expect(isSupportedImage({ type })).toBe(false);
    }
  });
});

describe('uploadImage', () => {
  it('rejects unsupported types before touching Supabase', async () => {
    await expect(
      uploadImage({ name: 'evil.svg', type: 'image/svg+xml' }, 'personnel'),
    ).rejects.toThrow(/Unsupported file type/);
  });
});

describe('imagesNoLongerUsed', () => {
  it('returns images dropped between two versions of a record', () => {
    expect(imagesNoLongerUsed(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
    expect(imagesNoLongerUsed(['a'], ['a', 'new'])).toEqual([]);
    expect(imagesNoLongerUsed(undefined, ['a'])).toEqual([]);
  });
});

describe('removeImagesByUrl', () => {
  const alert = vi.fn();
  vi.stubGlobal('alert', alert);
  vi.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    remove.mockReset();
    alert.mockReset();
  });

  it('deletes each bucket file once and skips external URLs', async () => {
    remove.mockResolvedValue({ data: [{}], error: null });
    await removeImagesByUrl([`${BASE}/u/a.png`, `${BASE}/u/a.png`, 'https://example.com/x.png']);
    expect(remove).toHaveBeenCalledWith(['u/a.png']);
    expect(alert).not.toHaveBeenCalled();
  });

  it('does nothing when no URLs are in the bucket', async () => {
    await removeImagesByUrl(['https://example.com/x.png']);
    expect(remove).not.toHaveBeenCalled();
  });

  it('alerts when storage silently skips files (blocked by RLS)', async () => {
    remove.mockResolvedValue({ data: [{}], error: null });
    await removeImagesByUrl([`${BASE}/u/a.png`, `${BASE}/u/b.png`]);
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/1 of 2 image file/));
  });

  it('alerts when the request fails', async () => {
    remove.mockResolvedValue({ data: null, error: new Error('network') });
    await removeImagesByUrl([`${BASE}/u/a.png`]);
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/1 of 1 image file/));
  });
});
