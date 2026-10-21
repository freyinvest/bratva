const PROJECT_ID = 'bratva-msg';
const IDENTITY_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
const R2_PUBLIC_BASE_URL = 'https://pub-96c44975a3a04098be85bbc06e4c4c7b.r2.dev';
const ALLOWED_ORIGINS = new Set([
  'https://bratva-msg.web.app',
  'https://bratva-msg.firebaseapp.com',
]);

function json(body, status, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function error(status, message, origin) {
  return json({ error: message }, status, origin);
}

async function verifiedUid(idToken, apiKey) {
  const response = await fetch(IDENTITY_LOOKUP + '?key=' + encodeURIComponent(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const payload = await response.json().catch(() => ({}));
  const user = Array.isArray(payload.users) ? payload.users[0] : null;
  if (!response.ok || !user || typeof user.localId !== 'string') {
    throw Object.assign(new Error('Sign in again to upload an avatar'), { status: 401 });
  }
  if (user.disabled === true) {
    throw Object.assign(new Error('This account is disabled'), { status: 403 });
  }
  return user.localId;
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return error(403, 'Origin not allowed', origin);

  const corsHeaders = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) corsHeaders.set('Access-Control-Allow-Origin', origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return error(405, 'Use POST', origin);
  if (!env.FIREBASE_API_KEY) return error(503, 'Avatar upload authentication is not configured', origin);
  if (!env.AVATARS_BUCKET) return error(503, 'Avatar storage is not configured', origin);

  try {
    const bearer = (request.headers.get('Authorization') || '').match(/^Bearer\\s+(.+)$/i);
    if (!bearer) return error(401, 'Sign in to upload an avatar', origin);

    const uid = await verifiedUid(bearer[1], env.FIREBASE_API_KEY);
    const data = await request.json().catch(() => null);
    if (!data || typeof data.dataUrl !== 'string') return error(400, 'Expected a JPEG data URL', origin);

    const match = data.dataUrl.match(/^data:image\\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || match[1].length > 700000) {
      return error(400, 'Only compressed JPEG avatars up to 512 KB are supported', origin);
    }

    let binary;
    try {
      binary = atob(match[1]);
    } catch {
      return error(400, 'Invalid avatar encoding', origin);
    }
    if (!binary.length || binary.length > 512 * 1024) {
      return error(413, 'Avatar must be no larger than 512 KB', origin);
    }

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      return error(400, 'Avatar content is not a valid JPEG', origin);
    }

    const id = crypto.randomUUID().toLowerCase();
    await env.AVATARS_BUCKET.put('avatars/' + id + '.jpg', bytes, {
      httpMetadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: { ownerUid: uid, purpose: 'avatar' },
    });

    return json({ url: R2_PUBLIC_BASE_URL + '/avatars/' + id + '.jpg' }, 201, origin);
  } catch (e) {
    const status = Number(e && e.status) || 500;
    return error(status, status < 500 && e instanceof Error ? e.message : 'Avatar storage temporarily unavailable', origin);
  }
}
