import { notifyError } from './notify';
import { supabase } from './supabase';

export const IMAGE_BUCKET = 'task-images';
const IMAGE_TYPE_PATTERN = /^image\/(jpeg|png|gif|webp)$/;

/** How long a signed image link stays valid. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** A cached link with less than this left is treated as expired and re-signed. */
export const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export const isSupportedImage = (file) => IMAGE_TYPE_PATTERN.test(file.type);

/**
 * Uploads an image into the current user's folder of the (private) bucket.
 * Paths are always `<user_id>/<folder>/<file>` so storage RLS can scope
 * access to the owner (see supabase/migrations/0001_baseline.sql).
 *
 * Throws on unsupported file types, when no user is signed in, or on
 * upload failure.
 *
 * @returns {Promise<string>} The storage path. Save this on the record, and
 *   show it with <StoredBackground>/<StoredImg> (or useImageUrl), which turn
 *   it into a short-lived signed link.
 */
export const uploadImage = async (file, folder) => {
  if (!isSupportedImage(file)) {
    throw new Error(
      `Unsupported file type "${file.type || 'unknown'}". Use JPEG, PNG, GIF or WebP.`,
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Image upload requires a signed-in user. Please log in again.');
  }

  // Extension from the validated MIME type, not the filename (which may have none)
  const fileExt = file.type.split('/')[1];
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const path = `${session.user.id}/${folder}/${fileName}`;

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file);
  if (error) throw error;

  return path;
};

/**
 * Maps a public (or signed) URL from this bucket back to its storage path.
 * Returns null for anything else (e.g. external image links).
 */
export const storagePathFromUrl = (url) => {
  const marker = `/${IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (!url.includes('supabase.co') || index === -1) return null;
  const withoutQuery = url.slice(index + marker.length).split('?')[0];
  return decodeURIComponent(withoutQuery);
};

/**
 * Maps whatever a record stores for an image to its path in the bucket: a bare
 * path (records saved since images went private) or a public URL from this
 * bucket (older records). Returns null for anything that isn't ours: external
 * links, data: and blob: URLs, and empty values.
 */
export const toStoragePath = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return storagePathFromUrl(value);
  return value;
};

/** URLs in `before` that are no longer in `after`, i.e. images a save dropped. */
export const imagesNoLongerUsed = (before = [], after = []) =>
  before.filter((url) => !after.includes(url));

// ---- Signed links -----------------------------------------------------
// The bucket is private, so every image is shown through a short-lived signed
// link. To keep that fast: links are cached, lookups made in the same tick are
// sent as ONE request, and the same path is never requested twice at once.

const signedCache = new Map(); // path -> { url, expiresAt }
const inFlight = new Map(); // path -> Promise<string | null>
let pendingBatch = null; // { paths: Set<string>, done: Promise<Map<string, string | null>> }

const isFresh = (entry) =>
  Boolean(entry) && entry.expiresAt - Date.now() > SIGNED_URL_REFRESH_MARGIN_MS;

const signBatch = async (paths) => {
  const results = new Map(paths.map((path) => [path, null]));
  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error('Error creating signed image URLs:', error);
    return results;
  }
  const expiresAt = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
  for (const item of data) {
    if (item.signedUrl) {
      signedCache.set(item.path, { url: item.signedUrl, expiresAt });
      results.set(item.path, item.signedUrl);
    } else {
      console.error('Could not sign image', item.path, item.error);
    }
  }
  return results;
};

const requestSignedUrl = (path) => {
  if (inFlight.has(path)) return inFlight.get(path);

  if (!pendingBatch) {
    const paths = new Set();
    const done = new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      pendingBatch = null;
      return signBatch([...paths]);
    });
    pendingBatch = { paths, done };
  }
  pendingBatch.paths.add(path);

  const promise = pendingBatch.done.then((results) => {
    inFlight.delete(path);
    return results.get(path) ?? null;
  });
  inFlight.set(path, promise);
  return promise;
};

/**
 * The link to show for a stored image value, if we already have one.
 * Synchronous, so components can render it without waiting. External links
 * and data: URLs are returned as they are; a bucket image that hasn't been
 * signed yet (or whose link is about to expire) returns null.
 */
export const peekImageUrl = (value) => {
  if (!value) return null;
  const path = toStoragePath(value);
  if (path === null) return value;
  const entry = signedCache.get(path);
  return isFresh(entry) ? entry.url : null;
};

/**
 * The link to show for a stored image value, signing it if needed.
 * Resolves null if it can't be signed (missing file, no permission, offline).
 * @returns {Promise<string | null>}
 */
export const getImageUrl = async (value) => {
  if (!value) return null;
  const path = toStoragePath(value);
  if (path === null) return value;
  const entry = signedCache.get(path);
  if (isFresh(entry)) return entry.url;
  return requestSignedUrl(path);
};

/** Forgets every signed link. Call on sign-out so the next user starts clean. */
export const clearImageUrlCache = () => {
  signedCache.clear();
};

/**
 * Opens a stored image full size in a new tab. Uses the already-signed link
 * when there is one so the browser doesn't treat the click as a blocked popup.
 */
export const openStoredImage = async (value) => {
  const url = peekImageUrl(value) ?? (await getImageUrl(value));
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Deletes the bucket files behind the given stored values (paths or public
 * URLs). Ignores external URLs. Alerts the user if any file couldn't be deleted.
 */
export const removeImagesByUrl = async (urls) => {
  const paths = [...new Set(urls.map(toStoragePath).filter(Boolean))];
  if (paths.length === 0) return;
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  // remove() silently skips files RLS won't let us delete, so compare counts too
  const removed = error ? 0 : (data?.length ?? 0);
  if (removed < paths.length) {
    console.error('Error deleting images from storage:', error ?? { paths, removed: data });
    notifyError(
      'IMAGE DELETE FAILED',
      `${paths.length - removed} of ${paths.length} image file(s) could not be removed from storage.`,
    );
  }
};

/**
 * Uploads several images, continuing past failures.
 * @returns {Promise<{ urls: string[], errors: string[] }>} `urls` are the
 *   storage paths to save (the name is kept for existing callers); errors are
 *   user-facing, one per failed file
 */
export const uploadImages = async (files, folder) => {
  const urls = [];
  const errors = [];
  for (const file of files) {
    try {
      urls.push(await uploadImage(file, folder));
    } catch (error) {
      console.error(`Upload failed for ${file.name}:`, error);
      errors.push(`${file.name}: ${error.message}`);
    }
  }
  return { urls, errors };
};

export const alertUploadErrors = (errors) => {
  if (errors.length > 0) notifyError('IMAGE UPLOAD FAILED', errors.join('\n'));
};
