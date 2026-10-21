import { auth } from '../lib/firebase';
import { AVATAR_WORKER_URL, resolveAvatarUrl } from '../utils/avatarUrl';

interface AvatarUploadResponse {
  url?: unknown;
  error?: unknown;
}

export function isAvatarUploadCandidate(avatar: string): boolean {
  return avatar.startsWith('data:image/jpeg;base64,') || resolveAvatarUrl(avatar) !== avatar;
}

/**
 * Keep legacy preset images on the Worker proxy instead of fetching Unsplash from the browser.
 * Upload only user-selected compressed JPEG data URLs to R2.
 */
export async function uploadAvatarIfNeeded(avatar: string): Promise<string> {
  const resolvedAvatar = resolveAvatarUrl(avatar);
  if (resolvedAvatar !== avatar) return resolvedAvatar;
  if (!avatar.startsWith('data:image/jpeg;base64,')) return avatar;

  const user = auth.currentUser;
  if (!user) throw new Error('Войди в Братву, чтобы загрузить аватар.');

  const idToken = await user.getIdToken();
  const response = await fetch(`${AVATAR_WORKER_URL}/avatars/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dataUrl: avatar }),
  });

  const payload = await response.json().catch(() => null) as AvatarUploadResponse | null;
  const expectedPrefix = `${AVATAR_WORKER_URL}/avatars/`;
  if (!response.ok || !payload || typeof payload.url !== 'string' || !payload.url.startsWith(expectedPrefix)) {
    throw new Error(
      typeof payload?.error === 'string'
        ? payload.error
        : `Не удалось загрузить аватар в R2 (${response.status}). Попробуйте ещё раз.`,
    );
  }

  return resolveAvatarUrl(payload.url);
}
