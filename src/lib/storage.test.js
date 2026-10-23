import { describe, expect, it, vi } from 'vitest';

import { isSupportedImage, storagePathFromUrl, uploadImage } from './storage';

vi.mock('./supabase', () => ({ supabase: null }));

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
