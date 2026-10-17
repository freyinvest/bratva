import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app, db } from '../lib/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

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
