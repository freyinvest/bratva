# Cloudflare Worker for Bratva push notifications

This Worker replaces the Firestore-triggered Firebase Cloud Function so message push delivery can run on Cloudflare's free Worker tier. The existing Firebase Web Push / FCM subscription is still needed.

## 1. Configure the Worker

In Cloudflare Dashboard, open the existing Worker named **bratva**. Replace its `Hello World` source with the complete contents of [worker.js](./worker.js), then deploy.

Open Worker settings and add:

- **Text variable** `FIREBASE_API_KEY`: the Web API key from Firebase Console → Project settings → General. This is the public Firebase client API key, not an Admin credential.
- **Secret** `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete JSON key for a service account in the `bratva-msg` Google Cloud project. Never commit this file to GitHub or paste it into chat.
- **Text variable** `ALLOWED_ORIGINS` (optional): comma-separated browser origins. The default allows `https://bratva-msg.web.app`, `https://bratva-msg.firebaseapp.com`, and `http://localhost:3000`.

The service account needs Firestore read/write access for chat, block-list, push-token, and `pushDispatches` documents, plus permission to send FCM messages. Use the narrowest roles available in the project. The predefined roles typically needed are **Cloud Datastore User** (`roles/datastore.user`) and **Firebase Cloud Messaging API Admin** (`roles/firebasecloudmessaging.admin`). See [Google Cloud FCM roles](https://cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging).

## 2. Configure the web push key

In GitHub → repository Settings → Secrets and variables → Actions, add secret `VITE_FIREBASE_VAPID_KEY` using the **Web Push certificate key pair → Key pair** public key from Firebase Console → Project settings → Cloud Messaging. This is not the service-account private key.

The Hosting workflow passes this value into the Vite build. If it is absent, users will see an explanatory message when they try to enable push.

## 3. Deploy and test

1. Merge the pull request only after build/typecheck checks pass.
2. Wait for the Hosting workflow to complete successfully.
3. Open Bratva, sign in with a verified account, and go to Settings → Notifications and sounds → Push notifications → Enable.
4. Repeat on a second account/browser/device. Send a message and verify that the recipient gets a browser notification while the app is in the background.

The Worker verifies the Firebase ID token through Firebase Auth, checks the sender against the stored chat and message, respects a recipient's block record, and claims each message in `pushDispatches` to help prevent duplicate sends. Notification delivery is best-effort; a saved message will not be rolled back if the Worker is temporarily unavailable.

**Important:** Do not merge the separate PR that deploys `functions/sendMessagePush` if keeping Firebase on the Spark plan. Firebase Cloud Functions deployment requires Blaze billing and could duplicate notifications if both senders are active.
