/**
 * Firebase JS SDK initialization for the Expo client.
 *
 * Used ONLY for the Google Sign-In → Firebase ID-token exchange.
 * After we get the ID token we send it to the backend
 * (POST /api/auth/firebase) which verifies it with firebase-admin.
 *
 * NOTE: All EXPO_PUBLIC_FIREBASE_* values are *public* client-side keys.
 * Safe to ship in the JS bundle. Server-only secrets live in /app/backend/.env
 * (FIREBASE_CREDENTIALS_JSON, etc.).
 */
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Avoid double-init across Fast Refresh / multiple imports.
let _app: FirebaseApp;
if (getApps().length === 0) {
  _app = initializeApp(firebaseConfig);
} else {
  _app = getApp();
}

export const firebaseApp = _app;
export const firebaseAuth: Auth = getAuth(_app);

/**
 * Exchange a Google ID token (obtained from expo-auth-session/Google)
 * for a Firebase user, then return a fresh Firebase ID token suitable
 * for sending to the backend.
 */
export async function exchangeGoogleIdTokenForFirebaseIdToken(
  googleIdToken: string,
  googleAccessToken?: string,
): Promise<string> {
  const credential = GoogleAuthProvider.credential(googleIdToken, googleAccessToken);
  const userCredential = await signInWithCredential(firebaseAuth, credential);
  const idToken = await userCredential.user.getIdToken(/* forceRefresh */ true);
  return idToken;
}

export async function firebaseLogout() {
  try {
    await firebaseSignOut(firebaseAuth);
  } catch {
    // non-fatal — backend session is what matters
  }
}
