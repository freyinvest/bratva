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
export const DEFAULT_AVATAR_URL = '/avatars/default.svg';

/** Convert known legacy Unsplash photo links to the Worker proxy, avoiding direct access from the user's browser. */
export function resolveAvatarUrl(value: string | undefined | null): string {
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return value || '';
  if (value.startsWith(`${AVATAR_WORKER_URL}/avatars/`)) return value;

  try {
    const url = new URL(value);
    if (url.hostname !== 'images.unsplash.com') return value;
    const match = url.pathname.match(/^\/(photo-[A-Za-z0-9-]+)$/);
    if (!match || !LEGACY_UNSPLASH_PHOTO_IDS.has(match[1])) return value;
    return `${AVATAR_WORKER_URL}/avatars/legacy/${match[1]}.jpg`;
  } catch {
    return value;
  }
}
