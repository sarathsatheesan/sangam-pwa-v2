import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyClfuZtD0Si-oZ0QRJXcVFvyakYh0Csgyo",
  authDomain: "mithr-1e5f4.firebaseapp.com",
  projectId: "mithr-1e5f4",
  storageBucket: "mithr-1e5f4.firebasestorage.app",
  messagingSenderId: "699698490740",
  appId: "1:699698490740:web:1941b2de4cc25dac095021",
  measurementId: "G-K0P8RMYYFF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth - web persistence
const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage (may fail if not set up in Firebase console)
let storage: ReturnType<typeof getStorage> | null = null;
try {
  storage = getStorage(app);
} catch (error) {
  console.warn('Firebase Storage not configured:', error);
}

// Initialize Messaging (only in browsers that support it — not in Node/SSR or iOS webview)
let messaging: Messaging | null = null;
const initMessaging = async (): Promise<Messaging | null> => {
  if (messaging) return messaging;
  const supported = await isSupported();
  if (!supported) return null;
  messaging = getMessaging(app);
  return messaging;
};

export { app, auth, db, storage, initMessaging, getToken, onMessage };
