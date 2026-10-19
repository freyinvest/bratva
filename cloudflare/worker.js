const PROJECT_ID = 'bratva-msg';
const API_ROOT = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';
const IDENTITY_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

async function verifiedUid(idToken, apiKey) {
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
  if (user.emailVerified !== true) throw new WorkerError(403, 'Verify your email before sending notifications');
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

async function sendFcm(accessToken, token, body, chatId) {
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
          title: 'Братва — новое сообщение',
          body,
        },
        data: {
          title: 'Братва — новое сообщение',
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
  return response.ok;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = cors(origin, env);
    if (origin && !origins(env).includes(origin)) return json({ error: 'Origin not allowed' }, 403, headers);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'Use POST' }, 405, headers);

    try {
      if (!env.FIREBASE_API_KEY || !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        throw new WorkerError(503, 'Worker secrets are not configured');
      }
      const bearer = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
      if (!bearer) throw new WorkerError(401, 'Sign in to continue');
      const data = await request.json().catch(() => null);
      if (!data || typeof data !== 'object') throw new WorkerError(400, 'Expected JSON body');
      const chatId = assertDocId(data.chatId, 'chatId');
      const messageId = assertDocId(data.messageId, 'messageId');
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
      const encodedMessageId = encodeURIComponent(messageId);
      const chat = await getDocument(accessToken, 'chats/' + encodedChatId);
      if (!chat) throw new WorkerError(404, 'Chat or message not found');
      const participants = stringArrayField(chat, 'participants');
      if (!participants.includes(senderId)) throw new WorkerError(403, 'You are not a participant in this chat');

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
      if (!recipients.length) return json({ sent: 0 }, 200, headers);

      const rows = await queryTokens(accessToken, recipients);
      const tokens = Array.from(new Set(rows
        .filter((row) => recipients.includes(stringField(row.document, 'userId')))
        .map((row) => stringField(row.document, 'token'))
        .filter(Boolean)));
      if (!tokens.length) return json({ sent: 0 }, 200, headers);

      const claim = await claimOnce(accessToken, chatId, messageId, senderId);
      if (!claim.ok) return json({ sent: 0, duplicate: true }, 200, headers);

      const body = notificationText(message);
      const results = await Promise.all(tokens.map(async (token) => {
        try {
          return await sendFcm(accessToken, token, body, chatId);
        } catch {
          return false;
        }
      }));
      const sent = results.filter(Boolean).length;
      if (!sent) {
        await releaseClaim(accessToken, claim.id);
        throw new WorkerError(503, 'Firebase Cloud Messaging rejected the notification');
      }
      return json({ sent, failed: results.length - sent }, 200, headers);
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
