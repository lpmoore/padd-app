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
