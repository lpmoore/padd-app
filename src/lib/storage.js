import { supabase } from './supabase';

export const IMAGE_BUCKET = 'task-images';
const IMAGE_TYPE_PATTERN = /^image\/(jpeg|png|gif|webp)$/;

export const isSupportedImage = (file) => IMAGE_TYPE_PATTERN.test(file.type);

/**
 * Uploads an image into the current user's folder of the shared bucket.
 * Paths are always `<user_id>/<folder>/<file>` so storage RLS can scope
 * access to the owner (see supabase_rls_policies.sql).
 *
 * Throws on unsupported file types, when no user is signed in, or on
 * upload failure.
 *
 * @returns {Promise<string>} The public URL of the uploaded file.
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

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file);
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return publicUrl;
};

/**
 * Maps a public URL from this bucket back to its storage path.
 * Returns null for anything else (e.g. external image links).
 */
export const storagePathFromUrl = (url) => {
  const marker = `/${IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (!url.includes('supabase.co') || index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
};

/** Deletes the bucket files behind the given public URLs. Ignores external URLs. */
export const removeImagesByUrl = async (urls) => {
  const paths = urls.map(storagePathFromUrl).filter(Boolean);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  if (error) console.error('Error deleting images from storage:', error);
};

/**
 * Uploads several images, continuing past failures.
 * @returns {Promise<{ urls: string[], errors: string[] }>} errors are user-facing, one per failed file
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
  if (errors.length > 0) alert(`IMAGE UPLOAD FAILED\n\n${errors.join('\n')}`);
};
