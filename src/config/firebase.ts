import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseApp } from './firebaseApp';

// The web Firebase bundle supplies browser persistence through getAuth.
export { firebaseApp } from './firebaseApp';
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
// Reserved for future uploads; signup photos currently live in Firestore.
export const storage = getStorage(firebaseApp);
