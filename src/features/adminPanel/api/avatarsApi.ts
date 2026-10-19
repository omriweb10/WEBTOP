/** Profile pictures in the private "avatars" bucket (path: <profileId>/<random>.<ext>). */
import { db, unwrap } from './adminClient';
import { updateUser } from './usersApi';

const BUCKET = 'avatars';
const URL_TTL_SECONDS = 3600;

/** Uploads a processed picture, points the profile at it and removes the previous file. */
export async function replaceAvatar(profileId: string, image: Blob, previousPath: string | null): Promise<string> {
  const extension = image.type === 'image/webp' ? 'webp' : image.type === 'image/png' ? 'png' : 'jpg';
  const path = `${profileId}/${crypto.randomUUID()}.${extension}`;
  await unwrap(db().storage.from(BUCKET).upload(path, image, { contentType: image.type, upsert: false, cacheControl: '31536000' }));
  try {
    await updateUser(profileId, { avatar_path: path });
  } catch (error) {
    await db().storage.from(BUCKET).remove([path]);
    throw error;
  }
  if (previousPath) await removeAvatarFile(previousPath);
  return path;
}

/** Removes the picture from a profile and from storage. */
export async function clearAvatar(profileId: string, path: string): Promise<void> {
  await updateUser(profileId, { avatar_path: null });
  await removeAvatarFile(path);
}

/** Deletes a stored file (best effort: a leftover file is harmless and private). */
export async function removeAvatarFile(path: string): Promise<void> {
  await db().storage.from(BUCKET).remove([path]).catch(() => undefined);
}

/** Signed URLs for several pictures at once (the bucket is private). */
export async function signAvatarUrls(paths: readonly string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const rows = await unwrap<Array<{ path: string | null; signedUrl: string | null; error: string | null }>>(
    db().storage.from(BUCKET).createSignedUrls([...paths], URL_TTL_SECONDS),
  );
  const urls: Record<string, string> = {};
  for (const row of rows) if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
  return urls;
}
