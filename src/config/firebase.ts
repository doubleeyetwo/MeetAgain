import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
// getReactNativePersistence ships only in Firebase's react-native build, but its export map
// lists "types" ahead of "react-native" so TypeScript resolves the web typings instead.
// Metro picks the correct build at runtime. Drop this suppression once Firebase
// reorders its export map; TypeScript will flag it as unused when that happens.
// @ts-expect-error -- missing from the web typings, present in the RN bundle.
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Reuse the app during Expo Fast Refresh instead of initializing Firebase again.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Plain getAuth keeps the session in memory only, so a restart signs the user out.
// AsyncStorage persistence is what carries the session across app launches.
function createAuth() {
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Fast Refresh re-runs this module while auth is already initialized.
    return getAuth(firebaseApp);
  }
}

export const auth = createAuth();
export const db = getFirestore(firebaseApp);
// Reserved for future uploads; signup photos currently live in Firestore.
export const storage = getStorage(firebaseApp);
