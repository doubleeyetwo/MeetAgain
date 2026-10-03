import { createUserWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { auth, db } from '@/config/firebase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  profilePending: boolean;
  createAccount: (email: string, password: string) => Promise<void>;
};
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  profilePending: false,
  createAccount: async () => { throw new Error('AuthProvider is missing.'); },
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilePending, setProfilePending] = useState(false);
  const creating = useRef(false);
  const busy = useRef(false);
  const pendingUser = useRef<User | null>(null);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    // Firebase signs in immediately; keep the signup screen visible until its profile is saved.
    if (!creating.current) setUser(nextUser);
    setLoading(false);
  }), []);

  const createAccount = async (email: string, password: string) => {
    if (busy.current) return;
    busy.current = true;
    creating.current = true;
    try {
      const retrying = pendingUser.current !== null;
      const account = pendingUser.current ?? (await createUserWithEmailAndPassword(auth, email, password)).user;
      pendingUser.current = account;
      const profile = doc(db, 'users', account.uid);
      // A previous write may have committed even if its response was lost.
      if (!retrying || !(await getDoc(profile)).exists()) {
        await setDoc(profile, {
          id: account.uid,
          email: account.email,
          displayName: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      pendingUser.current = null;
      setProfilePending(false);
      setUser(account);
    } catch (error) {
      if (pendingUser.current) {
        setProfilePending(true);
        throw new Error('Your account was created, but your profile could not be saved. Tap Retry to finish setup.');
      }
      throw error;
    } finally {
      // A failed profile write stays gated; Retry writes the same account's profile.
      creating.current = pendingUser.current !== null;
      busy.current = false;
    }
  };

  return <AuthContext.Provider value={{ user, loading, profilePending, createAccount }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
