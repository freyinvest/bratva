const LEGACY_UNSPLASH_PHOTO_IDS = new Set([
  'photo-1492562080023-ab3db95bfbce',
  'photo-1500648767791-00dcc994a43e',
  'photo-1503376780353-7e6692767b70',
  'photo-1517245386807-bb43f82c33c4',
  'photo-1522071820081-009f0129c71c',
  'photo-1506794778202-cad84cf45f1d',
  'photo-1507003211169-0a1dd7228f2d',
  'photo-1519085360753-af0119f7cbe7',
  'photo-1522075469751-3a6694fb2f61',
  'photo-1527980965255-d3b416303d12',
  'photo-1529156069898-49953e39b3ac',
  'photo-1534528741775-53994a69daeb',
  'photo-1535713875002-d1d0cf377fde',
  'photo-1549719386-74dfcbf7dbed',
  'photo-1552519507-da3b142c6e3d',
  'photo-1566492031773-4f4e44671857',
  'photo-1570295999919-56ceb5ecca61',
  'photo-1580489944761-15a19d654956',
]);

export const AVATAR_WORKER_URL = 'https://bratva.vototene997.workers.dev';
export const R2_PUBLIC_BASE_URL = 'https://pub-96c44975a3a04098be85bbc06e4c4c7b.r2.dev';
export const DEFAULT_AVATAR_URL = '/avatars/default.svg';

/**
 * Convert saved Worker URLs and known legacy Unsplash presets to direct R2 URLs.
 * Image bytes should come from r2.dev, not workers.dev, because some Russian networks
 * terminate/limit larger Cloudflare Worker responses.
 */
export function resolveAvatarUrl(value: string | undefined | null): string {
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return value || '';

  try {
    const url = new URL(value);
    if (url.hostname === 'pub-96c44975a3a04098be85bbc06e4c4c7b.r2.dev') return value;

    if (url.hostname === 'bratva.vototene997.workers.dev') {
      const legacyWorkerPath = url.pathname.match(/^\\/avatars\\/legacy\\/(photo-[A-Za-z0-9-]+)\\.jpg$/);
      if (legacyWorkerPath && LEGACY_UNSPLASH_PHOTO_IDS.has(legacyWorkerPath[1])) {
        return `${R2_PUBLIC_BASE_URL}/legacy-presets/${legacyWorkerPath[1]}.jpg`;
      }
      const avatarPath = url.pathname.match(/^\\/avatars\\/[0-9a-f-]{36}\\.jpg$/i);
      if (avatarPath) return `${R2_PUBLIC_BASE_URL}${url.pathname}`;
    }

    if (url.hostname !== 'images.unsplash.com') return value;
    const match = url.pathname.match(/^\\/(photo-[A-Za-z0-9-]+)$/);
    if (!match || !LEGACY_UNSPLASH_PHOTO_IDS.has(match[1])) return value;
    return `${R2_PUBLIC_BASE_URL}/legacy-presets/${match[1]}.jpg`;
  } catch {
    return value;
  }
}

/**
 * If an older preset is missing from R2, ask the Worker to fetch and cache it with HEAD
 * (no multi-kilobyte image body crosses the Worker connection), then retry the direct R2 URL.
 */
export async function recoverAvatarImage(image: HTMLImageElement): Promise<void> {
  const failedUrl = image.currentSrc || image.src;
  const legacyMatch = failedUrl.match(/\\/legacy-presets\\/(photo-[A-Za-z0-9-]+)\\.jpg(?:[?#].*)?$/);
  image.onerror = null;

  if (legacyMatch && LEGACY_UNSPLASH_PHOTO_IDS.has(legacyMatch[1])) {
    const photoId = legacyMatch[1];
    try {
      const response = await fetch(`${AVATAR_WORKER_URL}/avatars/legacy/${photoId}.jpg`, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        image.onerror = () => {
          image.onerror = null;
          image.src = DEFAULT_AVATAR_URL;
        };
        image.src = `${R2_PUBLIC_BASE_URL}/legacy-presets/${photoId}.jpg?retry=${Date.now()}`;
        return;
      }
    } catch {
      // If the Worker can't prewarm the legacy item from this network, use local fallback.
    }
  }

  image.src = DEFAULT_AVATAR_URL;
}
