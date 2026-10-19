import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app, auth, db } from '../lib/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const PUSH_WORKER_URL = 'https://bratva.vototene997.workers.dev';
const PUSH_SW_VERSION = 'bratva-push-2026-10-19-1';


async function hasExpectedPushWorkerVersion(
  registration: ServiceWorkerRegistration,
): Promise<boolean> {
  const worker = registration.active;
  if (!worker || worker.state !== 'activated') return false;

  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const timeoutId = window.setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, 700);

    channel.port1.onmessage = (event: MessageEvent) => {
      window.clearTimeout(timeoutId);
      channel.port1.close();
      resolve(
        event.data?.type === 'BRATVA_PUSH_SW_READY' &&
        event.data?.version === PUSH_SW_VERSION,
      );
    };

    try {
      worker.postMessage({ type: 'BRATVA_PUSH_SW_PING' }, [channel.port2]);
    } catch {
      window.clearTimeout(timeoutId);
      channel.port1.close();
      resolve(false);
    }
  });
}

async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration> {
  const expectedScriptUrl = new URL('/sw.js', window.location.origin).href;
  const registration = await navigator.serviceWorker.register('/sw.js', {
    updateViaCache: 'none',
  });

  // Check the deployed script explicitly. An existing activated /sw.js may be
  // an older version that doesn't import the Firebase Messaging handler.
  await registration.update();

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    // When an update is waiting, activate it so registration doesn't continue
    // using an older service worker that lacks the background push handler.
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });

    if (
      registration.active?.scriptURL === expectedScriptUrl &&
      registration.active.state === 'activated' &&
      await hasExpectedPushWorkerVersion(registration)
    ) {
      return registration;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  throw new Error(
    'Фоновый обработчик push не обновился. Закройте другие вкладки Bratva в этом браузере, откройте сайт заново и нажмите «Обновить регистрацию».',
  );
}

function deviceId() {
  const key = 'bratva_push_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export async function enablePushNotifications(userId: string): Promise<void> {
  if (!userId) throw new Error('Сначала войдите в Братву.');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Этот браузер не поддерживает push-уведомления.');
  }
  if (!(await isSupported())) throw new Error('Push-уведомления не поддерживаются этим браузером.');
  if (!VAPID_KEY) throw new Error('Не настроен VITE_FIREBASE_VAPID_KEY в сборке сайта.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Разрешите уведомления в настройках браузера.');

  // The Firebase handler is imported by the generated PWA /sw.js.
  // Never register /firebase-messaging-sw.js separately at the same '/' scope.
  const registration = await registerAppServiceWorker();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('Firebase не выдал push-токен. Попробуйте ещё раз.');

  await setDoc(doc(db, 'pushTokens', `${userId}_${deviceId()}`), {
    userId,
    token,
    updatedAt: Date.now(),
    platform: navigator.userAgent.slice(0, 180),
  });
}

export async function disablePushNotifications(userId: string): Promise<void> {
  if (!userId) return;
  const id = localStorage.getItem('bratva_push_device_id');
  if (id) await deleteDoc(doc(db, 'pushTokens', `${userId}_${id}`));
}

export async function listenForForegroundPush(
  onNotification: (title: string, body: string) => void,
): Promise<() => void> {
  if (!(await isSupported())) return () => undefined;
  const unsubscribe = onMessage(getMessaging(app), (payload) => {
    onNotification(
      payload.notification?.title || 'Братва — новое сообщение',
      payload.notification?.body || payload.data?.body || 'Вам пришло новое сообщение',
    );
  });
  return unsubscribe;
}

/**
 * Notify Cloudflare after Firestore confirms the message was written.
 * The Worker verifies the Firebase token and re-reads chat/message data.
 */
export async function notifyPushWorkerForMessage(
  chatId: string,
  messageId: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Сессия Firebase не найдена.');
  const idToken = await user.getIdToken();

  const response = await fetch(PUSH_WORKER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chatId, messageId }),
  });
  const payload = await response.json().catch(() => null) as {
    sent?: unknown;
    failed?: unknown;
    duplicate?: unknown;
    reason?: unknown;
    recipientCount?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok || !payload || typeof payload.sent !== 'number') {
    throw new Error(typeof payload?.error === 'string'
      ? payload.error
      : `Cloudflare Worker не подтвердил отправку уведомления (${response.status}).`);
  }
  if (payload.sent === 0 && payload.duplicate !== true) {
    console.warn('Bratva push diagnostic: Worker processed message but sent no notifications.', {
      reason: payload.reason || 'no_successful_delivery',
      recipientCount: payload.recipientCount,
      failed: payload.failed,
    });
  }
}

export interface PushTestResult {
  action: 'testPush';
  recipientCount: number;
  tokenCount: number;
  sent: number;
  failed: number;
  reason?: string;
  failures?: Array<{
    httpStatus: number;
    fcmStatus: string;
    detail?: string;
  }>;
}

/**
 * Send a diagnostic notification to the other participant's registered browsers.
 * Requires the updated Cloudflare Worker. It does not create a Firestore message.
 */
export async function sendPushTestToChat(chatId: string): Promise<PushTestResult> {
  if (!chatId) throw new Error('Сначала откройте личный чат с получателем.');
  const user = auth.currentUser;
  if (!user) throw new Error('Сессия Firebase не найдена. Войдите заново.');

  const idToken = await user.getIdToken();
  const response = await fetch(PUSH_WORKER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'testPush', chatId }),
  });
  const payload = await response.json().catch(() => null) as
    | (PushTestResult & { error?: unknown })
    | null;

  if (!response.ok || !payload || payload.action !== 'testPush' ||
      typeof payload.sent !== 'number' || typeof payload.failed !== 'number' ||
      typeof payload.tokenCount !== 'number') {
    const message = typeof payload?.error === 'string'
      ? payload.error
      : `Cloudflare Worker не вернул результат push-теста (${response.status}). Проверьте, опубликована ли диагностическая версия Worker.`;
    throw new Error(message);
  }

  console.info('Bratva push test result', {
    chatId,
    recipientCount: payload.recipientCount,
    tokenCount: payload.tokenCount,
    sent: payload.sent,
    failed: payload.failed,
    reason: payload.reason,
    failures: payload.failures?.map(({ httpStatus, fcmStatus }) => ({ httpStatus, fcmStatus })),
  });
  return payload;
}

