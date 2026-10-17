const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');

initializeApp();

const db = getFirestore();

exports.sendMessagePush = onDocumentCreated(
  { document: 'chats/{chatId}/messages/{messageId}', region: 'us-central1' },
  async (event) => {
    const message = event.data?.data();
    if (!message || typeof message.senderId !== 'string') return;

    const chatSnapshot = await db.collection('chats').doc(event.params.chatId).get();
    if (!chatSnapshot.exists) return;
    const participants = Array.isArray(chatSnapshot.data().participants)
      ? chatSnapshot.data().participants.filter((id) => typeof id === 'string')
      : [];
    const recipients = participants.filter((id) => id !== message.senderId);
    if (!recipients.length) return;

    const body = typeof message.text === 'string' && message.text.trim()
      ? message.text.trim().slice(0, 180)
      : message.imageUrl ? '📷 Фотография'
      : message.voiceUrl ? '🎤 Голосовое сообщение'
      : 'Новое сообщение';

    const tokenSnapshots = await Promise.all(recipients.map((userId) =>
      db.collection('pushTokens').where('userId', '==', userId).get()
    ));
    const docs = tokenSnapshots.flatMap((snapshot) => snapshot.docs);
    const unique = new Map();
    for (const tokenDoc of docs) {
      const token = tokenDoc.data().token;
      if (typeof token === 'string' && token) unique.set(token, tokenDoc.ref);
    }
    if (!unique.size) return;

    const tokens = Array.from(unique.keys());
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      data: {
        title: 'Братва — новое сообщение',
        body,
        chatId: event.params.chatId,
        url: '/',
      },
      webpush: { headers: { Urgency: 'high', TTL: '86400' } },
    });

    const invalid = [];
    response.responses.forEach((result, index) => {
      if (!result.success && [
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
      ].includes(result.error?.code)) {
        const ref = unique.get(tokens[index]);
        if (ref) invalid.push(ref.delete());
      }
    });
    await Promise.all(invalid);
    logger.info('Push notification delivery attempted', {
      chatId: event.params.chatId,
      tokenCount: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  }
);
