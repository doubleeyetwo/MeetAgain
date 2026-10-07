import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, browserPopupRedirectResolver, getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Reuse the app during Expo Fast Refresh instead of initializing Firebase again.
const appExists = getApps().length > 0;
export const firebaseApp = appExists ? getApp() : initializeApp(firebaseConfig);
// Initialize before popup calls so web auth persists without delaying the user gesture.
export const auth = Platform.OS === 'web' && !appExists
  ? initializeAuth(firebaseApp, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  : getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
// Reserved for future uploads; signup photos currently live in Firestore.
export const storage = getStorage(firebaseApp);
