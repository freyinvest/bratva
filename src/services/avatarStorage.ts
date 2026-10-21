import { auth } from '../lib/firebase';

const AVATAR_WORKER_URL = 'https://bratva.vototene997.workers.dev';

interface AvatarUploadResponse {
  url?: unknown;
  error?: unknown;
}

/**
 * Upload a locally selected, compressed JPEG avatar to Cloudflare R2.
 * Preset/remote URLs and empty avatar values remain unchanged.
 */
export async function uploadAvatarIfNeeded(avatar: string): Promise<string> {
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

  return payload.url;
}
