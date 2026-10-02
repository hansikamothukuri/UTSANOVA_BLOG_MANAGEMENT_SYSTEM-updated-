import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-utsanova-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'utsanova-blog.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'utsanova-blog',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'utsanova-blog.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
};

// True only when a real Firebase web config was supplied via VITE_FIREBASE_* variables.
// When false, the placeholder 'demo' values above are in use and NO sign-in is possible.
export const isFirebaseConfigured =
  Boolean(import.meta.env.VITE_FIREBASE_API_KEY) &&
  !String(import.meta.env.VITE_FIREBASE_API_KEY).includes('demo');

if (!isFirebaseConfigured) {
  console.error(
    '[Firebase] VITE_FIREBASE_API_KEY is not set, so the Vite dev server did not load your client env file. ' +
      'Put VITE_FIREBASE_* in client/.env (loaded via envDir in vite.config.ts) and restart `npm run dev`.'
  );
}

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { app, auth };
export default app;
