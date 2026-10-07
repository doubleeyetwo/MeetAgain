import { createUserWithEmailAndPassword, onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { auth, db } from '@/config/firebase';
import { PROFILE_PHOTO_JPEG_PREFIX, PROFILE_PHOTO_MAX_DATA_URL_LENGTH } from './profilePhoto';
import { ValidProfile } from './profileValidation';

type SignupDraft = { email: string; password: string };
export type ProfilePhoto = { uri: string; dataUrl: string };
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  profilePending: boolean;
  setSignupDraft: (draft: SignupDraft) => void;
  createAccount: (profile: ValidProfile, photo?: ProfilePhoto) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  profilePending: false,
  setSignupDraft: () => {
    throw new Error('AuthProvider is missing.');
  },
  createAccount: async () => {
    throw new Error('AuthProvider is missing.');
  },
  signOut: async () => {
    throw new Error('AuthProvider is missing.');
  },
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilePending, setProfilePending] = useState(false);
  const isCreatingAccount = useRef(false);
  const isAccountCreationBusy = useRef(false);
  const pendingProfileUser = useRef<User | null>(null);
  // Ignore profile lookups that finish after a newer auth state arrives.
  const authChangeId = useRef(0);
  // This draft only lives in memory; a password never goes in navigation params or storage.
  const signupDraftRef = useRef<SignupDraft | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      const currentAuthChangeId = ++authChangeId.current;
      // Firebase signs in immediately; keep signup visible until the profile transaction commits.
      if (isCreatingAccount.current) {
        setLoading(false);
        return;
      }

      if (!nextUser) {
        pendingProfileUser.current = null;
        setProfilePending(false);
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Firebase auth alone is not enough to enter the app; the profile document gates access.
        const savedProfile = await getDoc(doc(db, 'users', nextUser.uid));
        if (currentAuthChangeId !== authChangeId.current || isCreatingAccount.current) return;

        if (savedProfile.exists()) {
          // Existing accounts created before this signup flow may not have profileComplete.
          pendingProfileUser.current = null;
          setProfilePending(false);
          setUser(nextUser);
        } else {
          pendingProfileUser.current = nextUser;
          setProfilePending(true);
          setUser(null);
        }
      } catch {
        if (currentAuthChangeId !== authChangeId.current || isCreatingAccount.current) return;
        // Keep the user in profile setup so a transient read failure cannot bypass the profile gate.
        pendingProfileUser.current = nextUser;
        setProfilePending(true);
        setUser(null);
      } finally {
        if (currentAuthChangeId === authChangeId.current) setLoading(false);
      }
    });
  }, []);

  const createAccount = async (profile: ValidProfile, photo?: ProfilePhoto) => {
    if (isAccountCreationBusy.current) return;

    const draft = signupDraftRef.current;
    if (!draft && !pendingProfileUser.current) {
      throw new Error('Your signup session expired. Go back and enter your password again.');
    }
    if (photo && (
      !photo.dataUrl.startsWith(PROFILE_PHOTO_JPEG_PREFIX) ||
      photo.dataUrl.length > PROFILE_PHOTO_MAX_DATA_URL_LENGTH
    )) {
      throw new Error('Choose a smaller profile photo and try again.');
    }

    isAccountCreationBusy.current = true;
    isCreatingAccount.current = true;
    try {
      // A retry after account creation reuses the signed-in user instead of creating a second account.
      const account = pendingProfileUser.current ?? (
        await createUserWithEmailAndPassword(auth, draft!.email, draft!.password)
      ).user;
      pendingProfileUser.current = account;

      const userRef = doc(db, 'users', account.uid);
      const usernameRef = doc(db, 'usernames', profile.username);
      // Auth account creation happens separately; this transaction keeps the username claim and profile atomic.
      await runTransaction(db, async (transaction) => {
        const existingProfile = await transaction.get(userRef);
        const usernameClaim = await transaction.get(usernameRef);
        // A prior transaction may have committed even if its response was lost.
        if (existingProfile.exists()) {
          if (existingProfile.data().profileComplete === true) return;
          throw new Error('This account already has an incomplete profile. Please contact support.');
        }
        if (usernameClaim.exists()) {
          throw new Error('That username is taken. Choose another and try again.');
        }
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
      pendingProfileUser.current = null;
      signupDraftRef.current = null;
      setProfilePending(false);
      setUser(account);
    } catch (error) {
      if (pendingProfileUser.current) {
        setProfilePending(true);
        const message = error instanceof Error ? error.message : '';
        if (message.includes('username is taken')) {
          throw error;
        }
        throw new Error('Your account was created, but your profile could not be saved. Try again to finish setup.');
      }
      throw error;
    } finally {
      isCreatingAccount.current = pendingProfileUser.current !== null;
      isAccountCreationBusy.current = false;
    }
  };

  const signOut = async () => {
    // Clear these before signing out so the auth listener takes its signed-out path
    // instead of the early return that protects an in-flight signup.
    isCreatingAccount.current = false;
    pendingProfileUser.current = null;
    signupDraftRef.current = null;
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      profilePending,
      setSignupDraft: (draft) => {
        signupDraftRef.current = draft;
      },
      createAccount,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
