/* Version handshake lets the page verify that the active root-scope worker loaded this FCM handler. */
const BRATVA_PUSH_SW_VERSION = 'bratva-push-2026-10-19-1';
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'BRATVA_PUSH_SW_PING') return;
  const port = event.ports && event.ports[0];
  if (port) {
    port.postMessage({
      type: 'BRATVA_PUSH_SW_READY',
      version: BRATVA_PUSH_SW_VERSION,
    });
  }
});

/* Handle notification clicks before importing Firebase Messaging so FCM does not replace this handler. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

/* Firebase Cloud Messaging background handler for «Братва». */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCP6oxJdaeblRtBBgO8oH-u1ArBJNMelc0',
  authDomain: 'bratva-msg.firebaseapp.com',
  projectId: 'bratva-msg',
  messagingSenderId: '608886709982',
  appId: '1:608886709982:web:f0e644be4df6a203a8ac4f',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // FCM displays notification-payload messages automatically in the background.
  // Only create a manual notification for data-only messages.
  if (payload.notification) return;

  const title = payload.data?.title || 'Братва — новое сообщение';
  const body = payload.data?.body || 'Вам пришло новое сообщение';
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.data?.chatId ? `bratva-${payload.data.chatId}` : 'bratva-message',
    data: { url: payload.data?.url || '/', chatId: payload.data?.chatId || '' },
  });
});


