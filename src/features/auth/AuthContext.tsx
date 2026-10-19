import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithCredential,
  User,
} from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { auth, db } from '@/config/firebase';
import { PROFILE_PHOTO_JPEG_PREFIX, PROFILE_PHOTO_MAX_DATA_URL_LENGTH } from './profilePhoto';
import { hasCompletedProfile, isGooglePhotoURL, profilePhotoFields } from './profileOnboarding';
import { ValidProfile } from './profileValidation';

type SignupDraft = { email: string; password: string };
export type ProfilePhoto = { uri: string; dataUrl: string };
export type GoogleProfilePhoto = { uri: string; photoURL: string };
export type PendingProfileDetails = { displayName: string; photoURL: string };
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  profilePending: boolean;
  pendingProfileDetails: PendingProfileDetails | null;
  setSignupDraft: (draft: SignupDraft) => void;
  createAccount: (profile: ValidProfile, photo?: ProfilePhoto | GoogleProfilePhoto) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  profilePending: false,
  pendingProfileDetails: null,
  setSignupDraft: () => {
    throw new Error('AuthProvider is missing.');
  },
  createAccount: async () => {
    throw new Error('AuthProvider is missing.');
  },
  signInWithGoogle: async () => {
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
  const [pendingProfileDetails, setPendingProfileDetails] = useState<PendingProfileDetails | null>(null);
  const isCreatingAccount = useRef(false);
  const isAccountCreationBusy = useRef(false);
  const pendingProfileUser = useRef<User | null>(null);
  // Ignore profile lookups that finish after a newer auth state arrives.
  const authChangeId = useRef(0);
  // This draft only lives in memory; a password never goes in navigation params or storage.
  const signupDraftRef = useRef<SignupDraft | null>(null);

  const resolveProfile = useCallback(async (nextUser: User | null, currentAuthChangeId: number) => {
      // Firebase signs in immediately; keep signup visible until the profile transaction commits.
      if (isCreatingAccount.current) {
        setLoading(false);
        return;
      }

      if (!nextUser) {
        pendingProfileUser.current = null;
        setPendingProfileDetails(null);
        setProfilePending(false);
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Firebase auth alone is not enough to enter the app; the profile document gates access.
        const savedProfile = await getDoc(doc(db, 'users', nextUser.uid));
        if (currentAuthChangeId !== authChangeId.current || isCreatingAccount.current) return;

        const profile = savedProfile.exists() ? savedProfile.data() : null;
        if (profile && hasCompletedProfile(profile)) {
          // Existing accounts created before this signup flow may not have profileComplete.
          pendingProfileUser.current = null;
          setPendingProfileDetails(null);
          setProfilePending(false);
          setUser(nextUser);
          // Older username claims contain only a UID. Add the public name only when the
          // claim still belongs to this account; a missing or conflicting claim is left alone.
          if (typeof profile.username === 'string' && typeof profile.displayName === 'string') {
            void runTransaction(db, async (transaction) => {
              const usernameRef = doc(db, 'usernames', profile.username);
              const claim = await transaction.get(usernameRef);
              if (claim.exists() && claim.data().uid === nextUser.uid && !claim.data().displayName) {
                transaction.update(usernameRef, { displayName: profile.displayName });
              }
            }).catch(() => {
              // Directory repair is best effort and must not make a valid account unusable.
            });
          }
        } else {
          pendingProfileUser.current = nextUser;
          setPendingProfileDetails({
            displayName: nextUser.displayName ?? '',
            photoURL: nextUser.providerData.some((provider) => provider.providerId === 'google.com')
              && isGooglePhotoURL(nextUser.photoURL ?? '') ? nextUser.photoURL! : '',
          });
          setProfilePending(true);
          setUser(null);
        }
      } catch {
        if (currentAuthChangeId !== authChangeId.current || isCreatingAccount.current) return;
        // Keep the user in profile setup so a transient read failure cannot bypass the profile gate.
        pendingProfileUser.current = nextUser;
        setPendingProfileDetails({
          displayName: nextUser.displayName ?? '',
          photoURL: nextUser.providerData.some((provider) => provider.providerId === 'google.com')
            && isGooglePhotoURL(nextUser.photoURL ?? '') ? nextUser.photoURL! : '',
        });
        setProfilePending(true);
        setUser(null);
      } finally {
        if (currentAuthChangeId === authChangeId.current) setLoading(false);
      }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    const currentAuthChangeId = ++authChangeId.current;
    void resolveProfile(nextUser, currentAuthChangeId);
  }), [resolveProfile]);

  const createAccount = async (profile: ValidProfile, photo?: ProfilePhoto | GoogleProfilePhoto) => {
    if (isAccountCreationBusy.current) return;

    const draft = signupDraftRef.current;
    if (!draft && !pendingProfileUser.current) {
      throw new Error('Your signup session expired. Go back and enter your password again.');
    }
    if (photo && 'dataUrl' in photo && (
      !photo.dataUrl.startsWith(PROFILE_PHOTO_JPEG_PREFIX) ||
      photo.dataUrl.length > PROFILE_PHOTO_MAX_DATA_URL_LENGTH
    )) {
      throw new Error('Choose a smaller profile photo and try again.');
    }
    if (photo && 'photoURL' in photo && (
      !pendingProfileUser.current?.providerData.some((provider) => provider.providerId === 'google.com') ||
      photo.photoURL !== pendingProfileUser.current.photoURL ||
      !isGooglePhotoURL(photo.photoURL)
    )) {
      throw new Error('Could not use your Google profile photo. Choose another photo or continue without one.');
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
      const friendCountRef = doc(db, 'friendCounts', account.uid);
      // Public details use the same account UID as the private profile.
      const publicProfileRef = doc(db, 'publicProfiles', account.uid);
      // Auth account creation happens separately; this transaction keeps the username claim and profile atomic.
      await runTransaction(db, async (transaction) => {
        const existingProfile = await transaction.get(userRef);
        const usernameClaim = await transaction.get(usernameRef);
        const friendCount = await transaction.get(friendCountRef);
        // A prior transaction may have committed even if its response was lost.
        if (existingProfile.exists() && existingProfile.data().profileComplete !== false) {
          if (existingProfile.data().profileComplete === true) return;
          throw new Error('This account already has a profile. Please sign in.');
        }
        if (usernameClaim.exists()) {
          throw new Error('That username is taken. Choose another and try again.');
        }
        // Keep the username directory minimal; public profile details live in publicProfiles.
        // Email stays owner-only, while birthday and photo are copied to the public profile.
        transaction.set(usernameRef, { uid: account.uid, displayName: profile.displayName });
        if (!friendCount.exists()) transaction.set(friendCountRef, { count: 0 });
        const profileData = {
          id: account.uid,
          email: account.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          displayName: profile.displayName,
          username: profile.username,
          dateOfBirth: profile.dateOfBirth,
          profileComplete: true,
          ...profilePhotoFields(photo),
          createdAt: existingProfile.exists() ? existingProfile.data().createdAt : serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        transaction.set(userRef, profileData);
        // Save public details atomically with the profile and username claim.
        // Explicit fields keep email and private account data out.
        transaction.set(publicProfileRef, {
          id: account.uid,
          displayName: profile.displayName,
          username: profile.username,
          dateOfBirth: profile.dateOfBirth,
          ...profilePhotoFields(photo),
          createdAt: profileData.createdAt,
          updatedAt: serverTimestamp(),
        });
      });
      pendingProfileUser.current = null;
      setPendingProfileDetails(null);
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
        const retryError = new Error('Your account was created, but your profile could not be saved. Try again to finish setup.');
        if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
          Object.assign(retryError, { code: error.code });
        }
        throw retryError;
      }
      throw error;
    } finally {
      isCreatingAccount.current = false;
      isAccountCreationBusy.current = false;
    }
  };

  // Google returns an ID token; Firebase turns it into a session. Routing is left
  // to the listener above, which sends a user without a profile document into setup
  // and everyone else to Home, exactly as it does for email signups.
  const signInWithGoogle = useCallback(async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const { user: googleUser } = await signInWithCredential(auth, credential);
    // A previous profile save can leave the email signup guard active. A new
    // Google credential starts a fresh auth flow and must resolve its own gate.
    isCreatingAccount.current = false;
    signupDraftRef.current = null;
    pendingProfileUser.current = null;
    const currentAuthChangeId = ++authChangeId.current;
    await resolveProfile(googleUser, currentAuthChangeId);
  }, [resolveProfile]);

  const signOut = async () => {
    await firebaseSignOut(auth);
    // Clear the local gate after Firebase succeeds so Back cannot expose signed-out
    // screens while the unfinished account still has an active session.
    isCreatingAccount.current = false;
    pendingProfileUser.current = null;
    signupDraftRef.current = null;
    setPendingProfileDetails(null);
    setProfilePending(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      profilePending,
      pendingProfileDetails,
      setSignupDraft: (draft) => {
        signupDraftRef.current = draft;
      },
      createAccount,
      signInWithGoogle,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
