import { auth } from '../lib/firebase';

const AVATAR_WORKER_URL = 'https://bratva.vototene997.workers.dev';
const UNSPLASH_AVATAR_HOST = 'images.unsplash.com';

interface AvatarUploadResponse {
  url?: unknown;
  error?: unknown;
}

/**
 * True for compressed JPEG data URLs and the app's legacy Unsplash avatars.
 * These can be copied to R2 as part of a save/login migration.
 */
export function isAvatarUploadCandidate(avatar: string): boolean {
  if (avatar.startsWith('data:image/jpeg;base64,')) return true;
  try {
    const url = new URL(avatar);
    return url.protocol === 'https:' && url.hostname === UNSPLASH_AVATAR_HOST;
  } catch {
    return false;
  }
}

async function unsplashImageToJpegDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`Не удалось загрузить изображение аватара (${response.status}).`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Не удалось обработать стандартный аватар.'));
      element.src = objectUrl;
    });

    const maxDimension = 320;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Браузер не смог подготовить аватар.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Upload a locally selected JPEG or migrate one of the app's legacy Unsplash
 * preset avatars to R2. Other custom/remote URLs are left as-is.
 */
export async function uploadAvatarIfNeeded(avatar: string): Promise<string> {
  if (avatar.startsWith(`${AVATAR_WORKER_URL}/avatars/`)) return avatar;
  if (!isAvatarUploadCandidate(avatar)) return avatar;

  let dataUrl = avatar;
  if (!avatar.startsWith('data:image/jpeg;base64,')) {
    try {
      dataUrl = await unsplashImageToJpegDataUrl(avatar);
    } catch (error) {
      // Keep the app usable if the remote preset source is temporarily unavailable.
      console.warn('Could not copy an Unsplash preset to R2; keeping its original URL.', error);
      return avatar;
    }
  }

  const user = auth.currentUser;
  if (!user) throw new Error('Войди в Братву, чтобы загрузить аватар.');

  const idToken = await user.getIdToken();
  const response = await fetch(`${AVATAR_WORKER_URL}/avatars/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dataUrl }),
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
