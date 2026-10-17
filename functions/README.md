# Bratva push notifications

This Cloud Function sends data-only Firebase Cloud Messaging notifications when a new Firestore document is created at `chats/{chatId}/messages/{messageId}`. The service worker displays them when the app is in the background or closed.

## One-time setup

1. In Firebase Console → Project settings → Cloud Messaging, create/get the **Web Push certificate (VAPID) key pair**.
2. Add repository/build environment variable `VITE_FIREBASE_VAPID_KEY` to the frontend build environment. It is a public web-push key, not a server secret. For a local build, put it in `.env.local`.
3. Ensure Firestore rules allow a signed-in app session to create/update only its own `pushTokens/{userId_deviceId}` document and read/delete that own token document. This app currently uses its own app-level user ID; review existing Firestore rules carefully before opening token writes broadly.
4. Install Firebase CLI, select project `bratva-msg`, then from the repository root run:
   ```sh
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```
5. Cloud Functions deployment requires the Firebase project to be on the **Blaze (pay-as-you-go)** plan and billing configured.
6. Deploy the frontend with the VAPID environment variable available during the Vite build. Hosting-only deployment does not deploy Cloud Functions.

The Firebase web config and VAPID public key are not server secrets. Never put service-account private keys in the frontend.
