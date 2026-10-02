import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let isFirebaseAdminInitialized = false;

export const initFirebaseAdmin = () => {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      // Vercel stores the value verbatim: drop accidental wrapping quotes
      privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
      // Format private key properly for multi-line PEM format
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      if (!getApps().length) {
        initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });
      }

      isFirebaseAdminInitialized = true;
      console.log('[Firebase Admin] Firebase Admin SDK initialized successfully for project:', projectId);
      return;
    } catch (error) {
      console.error('[Firebase Admin] Initialization failed:', error.message);
    }
  }

  console.error(
    '[Firebase Admin] Credentials missing or invalid. Protected admin API requests will be rejected until FIREBASE_ADMIN_* is set (server/.env locally, Vercel Environment Variables in production).'
  );
};

/**
 * Verifies a Firebase ID token with the Firebase Admin SDK.
 * This is the ONLY accepted path: no demo tokens, no simulated tokens, and no
 * unverified JWT decoding. Anything Firebase does not verify is rejected.
 */
export const verifyIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('No token provided');
  }

  if (!isFirebaseAdminInitialized) {
    throw new Error('Firebase Admin SDK is not initialized; cannot verify ID tokens');
  }

  try {
    return await getAuth().verifyIdToken(idToken);
  } catch (err) {
    // Log the error code only - never the token itself
    console.warn('[Firebase Admin] Token verification failed:', err.code || err.message);
    throw err;
  }
};

export default {
  initFirebaseAdmin,
  verifyIdToken,
};
