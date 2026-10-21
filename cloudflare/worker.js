const PROJECT_ID = 'bratva-msg';
const API_ROOT = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';
const IDENTITY_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
const LEGACY_AVATAR_IDS = new Set([
  'photo-1492562080023-ab3db95bfbce',
  'photo-1500648767791-00dcc994a43e',
  'photo-1503376780353-7e6692767b70',
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

let cachedAccessToken = '';
let cachedAccessTokenExpiresAt = 0;

class WorkerError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function origins(env) {
  return (env.ALLOWED_ORIGINS ||
    'https://bratva-msg.web.app,https://bratva-msg.firebaseapp.com,http://localhost:3000')
    .split(',').map((value) => value.trim()).filter(Boolean);
}

function cors(origin, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (origin && origins(env).includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function stringField(doc, key) {
  const value = doc && doc.fields && doc.fields[key] ? doc.fields[key].stringValue : '';
  return typeof value === 'string' ? value : '';
}

function stringArrayField(doc, key) {
  const values = doc && doc.fields && doc.fields[key] && doc.fields[key].arrayValue
    ? doc.fields[key].arrayValue.values
    : [];
  return Array.isArray(values)
    ? values.map((value) => value && value.stringValue).filter((value) => typeof value === 'string')
    : [];
}

function assertDocId(value, label) {
  if (typeof value !== 'string' || !value.length || value.length > 300 || value.includes('/')) {
    throw new WorkerError(400, 'Invalid ' + label);
  }
  return value;
}

function base64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlJson(value) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemBytes(pem) {
  const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '\n').replace(/\s/g, '');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function googleAccessToken(account) {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) return cachedAccessToken;

  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    base64UrlJson({ alg: 'RS256', typ: 'JWT' }),
    base64UrlJson({
      iss: account.client_email,
      sub: account.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ].join('.');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: unsigned + '.' + base64Url(new Uint8Array(signature)),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== 'string') {
    throw new WorkerError(503, 'Google service authentication failed');
  }
  cachedAccessToken = payload.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max(60, Number(payload.expires_in || 3600) - 90) * 1000;
  return cachedAccessToken;
}

async function verifiedUid(idToken, apiKey, requireVerifiedEmail = true) {
  const response = await fetch(IDENTITY_LOOKUP + '?key=' + encodeURIComponent(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const payload = await response.json().catch(() => ({}));
  const user = Array.isArray(payload.users) ? payload.users[0] : null;
  if (!response.ok || !user || typeof user.localId !== 'string') {
    throw new WorkerError(401, 'Sign in again to send notifications');
  }
  if (user.disabled === true) throw new WorkerError(403, 'This account is disabled');
  if (requireVerifiedEmail && user.emailVerified !== true) throw new WorkerError(403, 'Verify your email before sending notifications');
  return user.localId;
}

async function getDocument(accessToken, path) {
  const response = await fetch(API_ROOT + '/' + path, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new WorkerError(503, 'Unable to read Firebase data');
  return response.json();
}

async function queryTokens(accessToken, recipientIds) {
  const batches = [];
  for (let i = 0; i < recipientIds.length; i += 30) batches.push(recipientIds.slice(i, i + 30));
  const batchesResult = await Promise.all(batches.map(async (ids) => {
    const value = ids.length === 1
      ? { stringValue: ids[0] }
      : { arrayValue: { values: ids.map((id) => ({ stringValue: id })) } };
    const response = await fetch(API_ROOT + ':runQuery', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'pushTokens' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'userId' },
              op: ids.length === 1 ? 'EQUAL' : 'IN',
              value,
            },
          },
          select: { fields: [{ fieldPath: 'userId' }, { fieldPath: 'token' }] },
        },
      }),
    });
    if (!response.ok) throw new WorkerError(503, 'Unable to read push tokens');
    const result = await response.json();
    return Array.isArray(result) ? result.filter((row) => row.document) : [];
  }));
  return batchesResult.flat();
}

function isStalePushTokenFailure(result) {
  return result.fcmErrorCode === 'UNREGISTERED' ||
    (result.httpStatus === 404 && result.fcmStatus === 'NOT_FOUND');
}

// Remove only token documents tied to a token that FCM explicitly rejected as
// unregistered/not found. This lets the receiver register a fresh token later.
async function removeStalePushTokenDocuments(accessToken, tokenRows, results) {
  const staleTokens = new Set(results
    .filter(isStalePushTokenFailure)
    .map((result) => result.token)
    .filter(Boolean));
  if (!staleTokens.size) return 0;

  const documentIds = new Set();
  for (const row of tokenRows) {
    if (!row.document || !staleTokens.has(stringField(row.document, 'token'))) continue;
    const name = row.document.name;
    const marker = '/documents/pushTokens/';
    const markerIndex = typeof name === 'string' ? name.indexOf(marker) : -1;
    if (markerIndex < 0) continue;
    const id = name.slice(markerIndex + marker.length);
    if (id && !id.includes('/')) documentIds.add(id);
  }

  const removed = await Promise.all(Array.from(documentIds).map(async (id) => {
    try {
      const response = await fetch(API_ROOT + '/pushTokens/' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      return response.ok || response.status === 404;
    } catch {
      return false;
    }
  }));
  return removed.filter(Boolean).length;
}

async function claimOnce(accessToken, chatId, messageId, senderId) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(chatId + '/' + messageId));
  const id = Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const response = await fetch(API_ROOT + '/pushDispatches/' + id + '?currentDocument.exists=false', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        chatId: { stringValue: chatId },
        messageId: { stringValue: messageId },
        senderId: { stringValue: senderId },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (response.ok) return { ok: true, id };
  const error = await response.json().catch(() => ({}));
  if ([409, 412].includes(response.status) ||
      error?.error?.status === 'ALREADY_EXISTS' ||
      error?.error?.status === 'FAILED_PRECONDITION') return { ok: false, id };
  throw new WorkerError(503, 'Unable to reserve notification dispatch');
}

async function releaseClaim(accessToken, id) {
  await fetch(API_ROOT + '/pushDispatches/' + id, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + accessToken },
  }).catch(() => undefined);
}

function notificationText(message) {
  const text = stringField(message, 'text').trim();
  if (text) return text.slice(0, 180);
  if (stringField(message, 'imageUrl')) return '📷 Фотография';
  if (stringField(message, 'voiceUrl')) return '🎤 Голосовое сообщение';
  if (stringField(message, 'attachmentUrl')) return '📎 Файл';
  return 'Новое сообщение';
}

async function sendFcm(accessToken, token, body, chatId, title = 'Братва — новое сообщение') {
  const response = await fetch('https://fcm.googleapis.com/v1/projects/' + PROJECT_ID + '/messages:send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        // Explicit notification payload is more reliable for background Web Push delivery.
        notification: {
          title,
          body,
        },
        data: {
          title,
          body,
          chatId,
          url: '/',
        },
        webpush: {
          headers: { Urgency: 'high', TTL: '86400' },
          fcm_options: { link: 'https://bratva-msg.web.app/' },
        },
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return { ok: true, httpStatus: response.status };
  const fcmError = payload && payload.error ? payload.error : {};
  const errorDetails = Array.isArray(fcmError.details) ? fcmError.details : [];
  const typedFcmError = errorDetails.find((detail) =>
    detail && typeof detail.errorCode === 'string' &&
    (!detail['@type'] || detail['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError')
  );
  return {
    ok: false,
    httpStatus: response.status,
    fcmStatus: typeof fcmError.status === 'string' ? fcmError.status : 'FCM_ERROR',
    fcmErrorCode: typedFcmError && typeof typedFcmError.errorCode === 'string' ? typedFcmError.errorCode : '',
    fcmMessage: typeof fcmError.message === 'string' ? fcmError.message.slice(0, 180) : '',
  };
}


async function handleAvatarRead(request, env, headers, url) {
  if (!env.AVATARS_BUCKET) return json({ error: 'Avatar storage is not configured' }, 503, headers);

  const match = url.pathname.match(/^\/avatars\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.jpg$/i);
  if (!match) return json({ error: 'Avatar not found' }, 404, headers);

  const id = match[1].toLowerCase();
  const object = await env.AVATARS_BUCKET.get('avatars/' + id + '.jpg');
  if (!object) return json({ error: 'Avatar not found' }, 404, headers);

  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', object.httpMetadata && object.httpMetadata.contentType || 'image/jpeg');
  responseHeaders.set('Cache-Control', object.httpMetadata && object.httpMetadata.cacheControl || 'public, max-age=31536000, immutable');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  if (object.httpEtag) responseHeaders.set('ETag', object.httpEtag);

  return new Response(request.method === 'HEAD' ? null : object.body, {
    status: 200,
    headers: responseHeaders,
  });
}


async function handleLegacyAvatarRead(request, env, headers, url) {
  if (!env.AVATARS_BUCKET) return json({ error: 'Avatar storage is not configured' }, 503, headers);

  const match = url.pathname.match(/^\\/avatars\\/legacy\\/(photo-[A-Za-z0-9-]+)\\.jpg$/);
  if (!match || !LEGACY_AVATAR_IDS.has(match[1])) return json({ error: 'Avatar not found' }, 404, headers);

  const id = match[1];
  const key = 'legacy-presets/' + id + '.jpg';
  const stored = await env.AVATARS_BUCKET.get(key);
  let body;
  let etag = '';

  if (stored) {
    body = stored.body;
    etag = stored.httpEtag || '';
  } else {
    const source = new URL('https://images.unsplash.com/' + id);
    source.searchParams.set('fit', 'crop');
    source.searchParams.set('w', '400');
    source.searchParams.set('q', '80');
    source.searchParams.set('fm', 'jpg');

    let upstream;
    try {
      upstream = await fetch(source.toString(), {
        headers: { Accept: 'image/jpeg' },
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      console.warn('Could not fetch legacy avatar from upstream:', id, error);
      return json({ error: 'Avatar source unavailable' }, 502, headers);
    }

    if (!upstream.ok) return json({ error: 'Avatar source unavailable' }, 502, headers);
    const contentType = upstream.headers.get('Content-Type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) return json({ error: 'Invalid avatar source response' }, 502, headers);

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) return json({ error: 'Avatar source image is too large' }, 502, headers);
    body = bytes;

    // Copy the first successful request into R2 so future image reads do not depend on Unsplash.
    await env.AVATARS_BUCKET.put(key, bytes, {
      httpMetadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: { source: 'legacy-unsplash-preset' },
    }).catch((error) => console.warn('Could not persist legacy avatar in R2; serving the upstream image:', id, error));
  }

  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'image/jpeg');
  responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  if (etag) responseHeaders.set('ETag', etag);

  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: responseHeaders });
}

async function handleAvatarUpload(request, env, headers, url) {
  if (!env.FIREBASE_API_KEY) throw new WorkerError(503, 'Avatar upload authentication is not configured');
  if (!env.AVATARS_BUCKET) throw new WorkerError(503, 'Avatar storage is not configured');

  const bearer = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!bearer) throw new WorkerError(401, 'Sign in to upload an avatar');
  const uid = await verifiedUid(bearer[1], env.FIREBASE_API_KEY, false);

  const data = await request.json().catch(() => null);
  if (!data || typeof data.dataUrl !== 'string') throw new WorkerError(400, 'Expected a JPEG data URL');

  const match = data.dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[1].length > 700000) throw new WorkerError(400, 'Only compressed JPEG avatars up to 512 KB are supported');

  let binary;
  try {
    binary = atob(match[1]);
  } catch {
    throw new WorkerError(400, 'Invalid avatar encoding');
  }
  if (!binary.length || binary.length > 512 * 1024) {
    throw new WorkerError(413, 'Avatar must be no larger than 512 KB');
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new WorkerError(400, 'Avatar content is not a valid JPEG');
  }

  const id = crypto.randomUUID().toLowerCase();
  await env.AVATARS_BUCKET.put('avatars/' + id + '.jpg', bytes, {
    httpMetadata: {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      ownerUid: uid,
      purpose: 'avatar',
    },
  });

  return json({ url: new URL('/avatars/' + id + '.jpg', url.origin).toString() }, 201, headers);
}

function avatarErrorResponse(error, headers) {
  const status = error instanceof WorkerError ? error.status : 500;
  if (status >= 500) {
    console.error('Bratva avatar storage request failed', {
      status,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  return json({
    error: status < 500 && error instanceof Error
      ? error.message
      : 'Avatar storage temporarily unavailable',
  }, status, headers);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        worker: 'bratva-push',
        version: 'push-token-cleanup-v2',
        secretsConfigured: Boolean(env.FIREBASE_API_KEY && env.FIREBASE_SERVICE_ACCOUNT_JSON),
      }, 200, { 'Cache-Control': 'no-store' });
    }

    const origin = request.headers.get('Origin');
    const headers = cors(origin, env);
    if (origin && !origins(env).includes(origin)) return json({ error: 'Origin not allowed' }, 403, headers);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/avatars/legacy/')) {
      try {
        return await handleLegacyAvatarRead(request, env, headers, url);
      } catch (error) {
        return avatarErrorResponse(error, headers);
      }
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/avatars/')) {
      try {
        return await handleAvatarRead(request, env, headers, url);
      } catch (error) {
        return avatarErrorResponse(error, headers);
      }
    }

    if (request.method === 'POST' && url.pathname === '/avatars/upload') {
      try {
        return await handleAvatarUpload(request, env, headers, url);
      } catch (error) {
        return avatarErrorResponse(error, headers);
      }
    }

    if (request.method !== 'POST') return json({ error: 'Use POST' }, 405, headers);

    try {
      if (!env.FIREBASE_API_KEY || !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        throw new WorkerError(503, 'Worker secrets are not configured');
      }
      const bearer = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
      if (!bearer) throw new WorkerError(401, 'Sign in to continue');
      const data = await request.json().catch(() => null);
      if (!data || typeof data !== 'object') throw new WorkerError(400, 'Expected JSON body');
      const action = data.action === 'testPush' ? 'testPush' : 'message';
      const chatId = assertDocId(data.chatId, 'chatId');
      const messageId = action === 'testPush' ? '' : assertDocId(data.messageId, 'messageId');
      const senderId = await verifiedUid(bearer[1], env.FIREBASE_API_KEY);

      let account;
      try {
        account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch {
        throw new WorkerError(503, 'Service account secret is not valid JSON');
      }
      if (account.project_id !== PROJECT_ID || typeof account.client_email !== 'string' ||
          typeof account.private_key !== 'string') {
        throw new WorkerError(503, 'Service account secret is missing required fields');
      }

      const accessToken = await googleAccessToken(account);
      const encodedChatId = encodeURIComponent(chatId);
      const chat = await getDocument(accessToken, 'chats/' + encodedChatId);
      if (!chat) throw new WorkerError(404, 'Chat or message not found');
      const participants = stringArrayField(chat, 'participants');
      if (!participants.includes(senderId)) throw new WorkerError(403, 'You are not a participant in this chat');

      if (action === 'testPush') {
        if (stringField(chat, 'type') !== 'direct') {
          throw new WorkerError(400, 'Для теста push откройте личный чат один на один');
        }
        const targets = Array.from(new Set(participants.filter((id) => id && id !== senderId)));
        if (targets.length !== 1) throw new WorkerError(400, 'Не удалось определить получателя личного чата');
        const recipientId = targets[0];
        const block = await getDocument(
          accessToken,
          'userContacts/' + encodeURIComponent(recipientId + '_' + senderId),
        );
        if (block && stringField(block, 'status') === 'blocked') {
          return json({ action: 'testPush', sent: 0, failed: 0, tokenCount: 0, recipientCount: 1, reason: 'recipient_blocked' }, 200, headers);
        }

        const rows = await queryTokens(accessToken, [recipientId]);
        const recipientRows = rows.filter((row) => stringField(row.document, 'userId') === recipientId);
        const tokens = Array.from(new Set(recipientRows
          .map((row) => stringField(row.document, 'token'))
          .filter(Boolean)));
        if (!tokens.length) {
          console.warn('Push self-test found no recipient tokens', { chatId, recipientCount: 1 });
          return json({ action: 'testPush', sent: 0, failed: 0, tokenCount: 0, recipientCount: 1, reason: 'no_recipient_push_tokens' }, 200, headers);
        }

        const testBody = 'Тестовое push-уведомление. Чат и сообщения не изменены.';
        const results = await Promise.all(tokens.map(async (token) => {
          try {
            return { ...(await sendFcm(accessToken, token, testBody, chatId, 'Братва — тест уведомления')), token };
          } catch {
            return { ok: false, httpStatus: 0, fcmStatus: 'NETWORK_ERROR', fcmErrorCode: '', fcmMessage: '', token };
          }
        }));
        const staleTokensRemoved = await removeStalePushTokenDocuments(accessToken, recipientRows, results);
        const sent = results.filter((result) => result.ok).length;
        const failures = results.filter((result) => !result.ok).map(({ httpStatus, fcmStatus, fcmErrorCode, fcmMessage }) => ({
          httpStatus,
          fcmStatus,
          fcmErrorCode,
          detail: fcmMessage,
        }));
        console.info('FCM push self-test completed', {
          chatId,
          tokenCount: tokens.length,
          sent,
          failed: failures.length,
          staleTokensRemoved,
          failures: failures.map(({ httpStatus, fcmStatus, fcmErrorCode }) => ({ httpStatus, fcmStatus, fcmErrorCode })),
        });
        return json({
          action: 'testPush',
          recipientCount: 1,
          tokenCount: tokens.length,
          sent,
          failed: failures.length,
          staleTokensRemoved,
          failures,
          reason: sent === 0 ? 'fcm_rejected' : undefined,
        }, 200, headers);
      }

      const encodedMessageId = encodeURIComponent(messageId);
      const message = await getDocument(
        accessToken,
        'chats/' + encodedChatId + '/messages/' + encodedMessageId,
      );
      if (!message) throw new WorkerError(404, 'Chat or message not found');
      if (stringField(message, 'senderId') !== senderId || stringField(message, 'chatId') !== chatId) {
        throw new WorkerError(403, 'Message does not belong to this signed-in sender');
      }

      const candidates = Array.from(new Set(participants.filter((id) => id && id !== senderId)));
      if (!candidates.length) return json({ sent: 0 }, 200, headers);

      const checked = await Promise.all(candidates.map(async (recipientId) => {
        const blockPath = 'userContacts/' + encodeURIComponent(recipientId + '_' + senderId);
        const block = await getDocument(accessToken, blockPath);
        return block && stringField(block, 'status') === 'blocked' ? null : recipientId;
      }));
      const recipients = checked.filter((id) => typeof id === 'string');
      if (!recipients.length) {
        console.info('Push dispatch skipped: all recipients are blocked', { chatId });
        return json({ sent: 0, reason: 'all_recipients_blocked' }, 200, headers);
      }

      const rows = await queryTokens(accessToken, recipients);
      const recipientRows = rows.filter((row) => recipients.includes(stringField(row.document, 'userId')));
      const tokens = Array.from(new Set(recipientRows
        .map((row) => stringField(row.document, 'token'))
        .filter(Boolean)));
      if (!tokens.length) {
        console.warn('Push dispatch skipped: no registered recipient tokens', {
          chatId,
          recipientCount: recipients.length,
        });
        return json({ sent: 0, reason: 'no_recipient_push_tokens', recipientCount: recipients.length }, 200, headers);
      }

      const claim = await claimOnce(accessToken, chatId, messageId, senderId);
      if (!claim.ok) return json({ sent: 0, duplicate: true }, 200, headers);

      const body = notificationText(message);
      const results = await Promise.all(tokens.map(async (token) => {
        try {
          return { ...(await sendFcm(accessToken, token, body, chatId)), token };
        } catch {
          return { ok: false, httpStatus: 0, fcmStatus: 'NETWORK_ERROR', fcmErrorCode: '', fcmMessage: '', token };
        }
      }));
      const sent = results.filter((result) => result.ok).length;
      const failedResults = results.filter((result) => !result.ok);
      const staleTokensRemoved = await removeStalePushTokenDocuments(accessToken, recipientRows, results);
      if (failedResults.length) {
        console.warn('FCM rejected one or more push deliveries', {
          chatId,
          tokenCount: tokens.length,
          sent,
          failed: failedResults.length,
          failures: failedResults.map(({ httpStatus, fcmStatus, fcmErrorCode }) => ({ httpStatus, fcmStatus, fcmErrorCode })),
        });
      }
      if (!sent) await releaseClaim(accessToken, claim.id);
      const failureDetails = failedResults.map(({ httpStatus, fcmStatus, fcmErrorCode, fcmMessage }) => ({ httpStatus, fcmStatus, fcmErrorCode, detail: fcmMessage }));
      console.info('FCM push dispatch completed', {
        chatId,
        tokenCount: tokens.length,
        recipientCount: recipients.length,
        sent,
        failed: failedResults.length,
        failures: failureDetails,
      });
      return json({
        sent,
        failed: failedResults.length,
        tokenCount: tokens.length,
        recipientCount: recipients.length,
        failureDetails,
        staleTokensRemoved,
        reason: sent === 0 ? 'fcm_rejected' : undefined,
      }, 200, headers);
    } catch (error) {
      const status = error instanceof WorkerError ? error.status : 500;
      console.error('Bratva push worker request failed', {
        status,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return json({
        error: status < 500 && error instanceof Error
          ? error.message
          : 'Notification service temporarily unavailable',
      }, status, headers);
    }
  },
};
