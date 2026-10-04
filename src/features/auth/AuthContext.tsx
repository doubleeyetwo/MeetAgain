import { createUserWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { auth, db } from '@/config/firebase';
import { ValidProfile } from './profileValidation';

type SignupDraft = { email: string; password: string };
export type ProfilePhoto = { uri: string; dataUrl: string };
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  profilePending: boolean;
  setSignupDraft: (draft: SignupDraft) => void;
  createAccount: (profile: ValidProfile, photo?: ProfilePhoto) => Promise<void>;
};
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  profilePending: false,
  setSignupDraft: () => { throw new Error('AuthProvider is missing.'); },
  createAccount: async () => { throw new Error('AuthProvider is missing.'); },
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilePending, setProfilePending] = useState(false);
  const creating = useRef(false);
  const busy = useRef(false);
  const pendingUser = useRef<User | null>(null);
  const authChange = useRef(0);
  // This draft only lives in memory; a password never goes in navigation params or storage.
  const signupDraft = useRef<SignupDraft | null>(null);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    const change = ++authChange.current;
    // Firebase signs in immediately; keep signup visible until the profile transaction commits.
    if (creating.current) {
      setLoading(false);
      return;
    }
    if (!nextUser) {
      pendingUser.current = null;
      setProfilePending(false);
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const saved = await getDoc(doc(db, 'users', nextUser.uid));
      if (change !== authChange.current || creating.current) return;
      if (saved.exists()) {
        // Existing accounts created before this signup flow may not have profileComplete.
        pendingUser.current = null;
        setProfilePending(false);
        setUser(nextUser);
      } else {
        pendingUser.current = nextUser;
        setProfilePending(true);
        setUser(null);
      }
    } catch {
      if (change !== authChange.current || creating.current) return;
      // A profile check must succeed before opening the main app.
      pendingUser.current = nextUser;
      setProfilePending(true);
      setUser(null);
    } finally {
      if (change === authChange.current) setLoading(false);
    }
  }), []);

  const createAccount = async (profile: ValidProfile, photo?: ProfilePhoto) => {
    if (busy.current) return;
    const draft = signupDraft.current;
    if (!draft && !pendingUser.current) throw new Error('Your signup session expired. Go back and enter your password again.');
    if (photo && (!photo.dataUrl.startsWith('data:image/jpeg;base64,') || photo.dataUrl.length > 200023)) {
      throw new Error('Choose a smaller profile photo and try again.');
    }
    busy.current = true;
    creating.current = true;
    try {
      const account = pendingUser.current ?? (await createUserWithEmailAndPassword(auth, draft!.email, draft!.password)).user;
      pendingUser.current = account;

      const userRef = doc(db, 'users', account.uid);
      const usernameRef = doc(db, 'usernames', profile.username);
      await runTransaction(db, async (transaction) => {
        const existingProfile = await transaction.get(userRef);
        const usernameClaim = await transaction.get(usernameRef);
        // A prior transaction may have committed even if its response was lost.
        if (existingProfile.exists()) {
          if (existingProfile.data().profileComplete === true) return;
          throw new Error('This account already has an incomplete profile. Please contact support.');
        }
        if (usernameClaim.exists()) throw new Error('That username is taken. Choose another and try again.');
        transaction.set(usernameRef, { uid: account.uid });
        transaction.set(userRef, {
          id: account.uid,
          email: account.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          displayName: profile.displayName,
          username: profile.username,
          dateOfBirth: profile.dateOfBirth,
          profileComplete: true,
          ...(photo ? { photoDataUrl: photo.dataUrl } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      pendingUser.current = null;
      signupDraft.current = null;
      setProfilePending(false);
      setUser(account);
    } catch (error) {
      if (pendingUser.current) {
        setProfilePending(true);
        const message = error instanceof Error ? error.message : '';
        if (message.includes('username is taken')) throw error;
        throw new Error('Your account was created, but your profile could not be saved. Try again to finish setup.');
      }
      throw error;
    } finally {
      creating.current = pendingUser.current !== null;
      busy.current = false;
    }
  };

  return <AuthContext.Provider value={{ user, loading, profilePending, setSignupDraft: (draft) => { signupDraft.current = draft; }, createAccount }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
