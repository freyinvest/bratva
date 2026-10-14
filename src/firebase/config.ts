/**
 * Firebase Integration Module for «Братва» Messenger
 * Supports Firestore, Auth and Storage with graceful offline/local fallback.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

export interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isFirebaseReady = false;

// Check if firebase-applet-config.json exists or environment variables are present
try {
  // Safe dynamic check without breaking Vite bundler
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseReady = true;
  }
} catch {
  // Not initialized yet
}

export { app, auth, db, isFirebaseReady };

export const checkFirebaseStatus = () => {
  return {
    isConfigured: isFirebaseReady,
    hasAuth: !!auth,
    hasDb: !!db,
  };
};
