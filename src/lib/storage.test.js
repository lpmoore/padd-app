import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SIGNED_URL_REFRESH_MARGIN_MS,
  SIGNED_URL_TTL_SECONDS,
  clearImageUrlCache,
  getImageUrl,
  imagesNoLongerUsed,
  isSupportedImage,
  peekImageUrl,
  removeImagesByUrl,
  storagePathFromUrl,
  toStoragePath,
  uploadImage,
} from './storage';

const { remove, upload, createSignedUrls, getSession } = vi.hoisted(() => ({
  remove: vi.fn(),
  upload: vi.fn(),
  createSignedUrls: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession },
    storage: { from: () => ({ remove, upload, createSignedUrls }) },
  },
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
  afterEach(() => {
    upload.mockReset();
    getSession.mockReset();
  });

  it('rejects unsupported types before touching Supabase', async () => {
    await expect(
      uploadImage({ name: 'evil.svg', type: 'image/svg+xml' }, 'personnel'),
    ).rejects.toThrow(/Unsupported file type/);
    expect(upload).not.toHaveBeenCalled();
  });

  it('refuses to upload when nobody is signed in', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(uploadImage({ type: 'image/png' }, 'tasks/1')).rejects.toThrow(/signed-in user/);
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads into the user\'s own folder and returns the storage path, not a URL', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    upload.mockResolvedValue({ error: null });
    const file = { type: 'image/png' };

    const path = await uploadImage(file, 'tasks/42');

    expect(path).toMatch(/^user-1\/tasks\/42\/\d+-[a-z0-9]+\.png$/);
    expect(upload).toHaveBeenCalledWith(path, file);
  });

  it('throws when the upload fails', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    upload.mockResolvedValue({ error: new Error('quota') });
    await expect(uploadImage({ type: 'image/webp' }, 'x')).rejects.toThrow('quota');
  });
});

describe('toStoragePath', () => {
  it('passes bare paths (records saved since images went private) through', () => {
    expect(toStoragePath('user-1/tasks/42/a.png')).toBe('user-1/tasks/42/a.png');
  });

  it('maps older public URLs back to their path, including a signed URL\'s token', () => {
    expect(toStoragePath(`${BASE}/user-1/a%20b.png`)).toBe('user-1/a b.png');
    expect(
      toStoragePath('https://abc.supabase.co/storage/v1/object/sign/task-images/u/a.png?token=xyz'),
    ).toBe('u/a.png');
  });

  it('returns null for external links, data/blob URLs and empty values', () => {
    for (const value of ['https://example.com/a.png', 'data:image/png;base64,AAAA', 'blob:http://x/1', '', null, undefined]) {
      expect(toStoragePath(value)).toBeNull();
    }
  });
});

describe('signed image links', () => {
  const sign = (paths) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://abc.supabase.co/sign/${path}?token=t`, error: null })),
    error: null,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createSignedUrls.mockImplementation(async (paths) => sign(paths));
  });

  afterEach(() => {
    vi.useRealTimers();
    clearImageUrlCache();
    createSignedUrls.mockReset();
  });

  it('signs a path for the configured lifetime', async () => {
    const pending = getImageUrl('u/a.png');
    await vi.advanceTimersByTimeAsync(0);
    await expect(pending).resolves.toBe('https://abc.supabase.co/sign/u/a.png?token=t');
    expect(createSignedUrls).toHaveBeenCalledWith(['u/a.png'], SIGNED_URL_TTL_SECONDS);
  });

  it('signs an older public URL by its path', async () => {
    const pending = getImageUrl(`${BASE}/u/old.png`);
    await vi.advanceTimersByTimeAsync(0);
    await pending;
    expect(createSignedUrls).toHaveBeenCalledWith(['u/old.png'], SIGNED_URL_TTL_SECONDS);
  });

  it('sends lookups made in the same moment as ONE request, without duplicates', async () => {
    const all = Promise.all([getImageUrl('u/a.png'), getImageUrl('u/b.png'), getImageUrl('u/a.png')]);
    await vi.advanceTimersByTimeAsync(0);
    const urls = await all;

    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(['u/a.png', 'u/b.png'], SIGNED_URL_TTL_SECONDS);
    expect(urls[0]).toBe(urls[2]);
    expect(urls[1]).toContain('u/b.png');
  });

  it('reuses a cached link instead of asking again', async () => {
    const first = getImageUrl('u/a.png');
    await vi.advanceTimersByTimeAsync(0);
    await first;

    expect(peekImageUrl('u/a.png')).toContain('u/a.png');
    await getImageUrl('u/a.png');
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it('re-signs once a link is within the refresh margin of expiring', async () => {
    const first = getImageUrl('u/a.png');
    await vi.advanceTimersByTimeAsync(0);
    await first;

    await vi.advanceTimersByTimeAsync(SIGNED_URL_TTL_SECONDS * 1000 - SIGNED_URL_REFRESH_MARGIN_MS - 1000);
    expect(peekImageUrl('u/a.png')).not.toBeNull(); // still fresh

    await vi.advanceTimersByTimeAsync(2000);
    expect(peekImageUrl('u/a.png')).toBeNull(); // now stale

    const second = getImageUrl('u/a.png');
    await vi.advanceTimersByTimeAsync(0);
    await second;
    expect(createSignedUrls).toHaveBeenCalledTimes(2);
  });

  it('returns external links and data URLs as they are, without signing', async () => {
    expect(peekImageUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    await expect(getImageUrl('data:image/png;base64,AAAA')).resolves.toBe('data:image/png;base64,AAAA');
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it('gives null for empty values', async () => {
    expect(peekImageUrl(null)).toBeNull();
    await expect(getImageUrl('')).resolves.toBeNull();
  });

  it('resolves null (and does not cache) when signing fails', async () => {
    createSignedUrls.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    const failed = getImageUrl('u/a.png');
    await vi.advanceTimersByTimeAsync(0);
    await expect(failed).resolves.toBeNull();
    expect(peekImageUrl('u/a.png')).toBeNull();

    const retry = getImageUrl('u/a.png'); // a later attempt asks again
    await vi.advanceTimersByTimeAsync(0);
    await expect(retry).resolves.toContain('u/a.png');
  });

  it('resolves null for a file that cannot be signed while signing the rest', async () => {
    createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'u/a.png', signedUrl: 'https://abc.supabase.co/sign/u/a.png?token=t', error: null },
        { path: 'u/missing.png', signedUrl: null, error: 'Object not found' },
      ],
      error: null,
    });
    const both = Promise.all([getImageUrl('u/a.png'), getImageUrl('u/missing.png')]);
    await vi.advanceTimersByTimeAsync(0);
    const [ok, missing] = await both;
    expect(ok).toContain('u/a.png');
    expect(missing).toBeNull();
  });

  it('forgets every link when the cache is cleared (sign-out)', async () => {
    const first = getImageUrl('u/a.png');
    await vi.advanceTimersByTimeAsync(0);
    await first;
    clearImageUrlCache();
    expect(peekImageUrl('u/a.png')).toBeNull();
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

  it('accepts bare storage paths as well as older public URLs', async () => {
    remove.mockResolvedValue({ data: [{}, {}], error: null });
    await removeImagesByUrl(['u/new.png', `${BASE}/u/old.png`]);
    expect(remove).toHaveBeenCalledWith(['u/new.png', 'u/old.png']);
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
