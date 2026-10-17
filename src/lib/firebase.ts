
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCP6oxJdaeblRtBBgO8oH-u1ArBJNMelc0",
  authDomain: "bratva-msg.firebaseapp.com",
  projectId: "bratva-msg",
  messagingSenderId: "608886709982",
  appId: "1:608886709982:web:f0e644be4df6a203a8ac4f"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);