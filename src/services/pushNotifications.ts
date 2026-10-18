import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app, auth, db } from '../lib/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const PUSH_WORKER_URL = 'https://bratva.vototene997.workers.dev';

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

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
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
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(typeof payload.error === 'string'
      ? payload.error
      : `Cloudflare Worker вернул ошибку (${response.status}).`);
  }
}
