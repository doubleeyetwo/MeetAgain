import AsyncStorage from '@react-native-async-storage/async-storage';
// Firebase's TypeScript export map selects web typings even for its React Native
// bundle. Metro resolves this import to the native build at runtime.
// @ts-expect-error getReactNativePersistence is present in the native bundle.
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseApp } from './firebaseApp';

export { firebaseApp } from './firebaseApp';

function createAuth() {
  try {
    // Persist native sessions across app launches in AsyncStorage.
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // Only an existing instance from Fast Refresh is safe to reuse.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/already-initialized') {
      return getAuth(firebaseApp);
    }
    throw error;
  }
}

export const auth = createAuth();
export const db = getFirestore(firebaseApp);
// Reserved for future uploads; signup photos currently live in Firestore.
export const storage = getStorage(firebaseApp);
