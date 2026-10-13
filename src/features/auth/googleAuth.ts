import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';

// Closes the auth browser tab once Google redirects back into the app.
WebBrowser.maybeCompleteAuthSession();

// The provider validates its client ID during render, even when the button is
// disabled. A non-secret sentinel keeps an unconfigured install renderable.
const unconfiguredClientId = 'unconfigured-google-client-id';
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || unconfiguredClientId;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || unconfiguredClientId;
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || unconfiguredClientId;

// Check the ID this platform actually sends before enabling sign-in.
const clientIdForPlatform = Platform.select({
  ios: iosClientId,
  android: androidClientId,
  default: webClientId,
});
const isExpoGo = Platform.OS !== 'web' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type GoogleSignIn = {
  /** Opens the Google consent screen. */
  signIn: () => void;
  pending: boolean;
  error: string;
  /** False until the client IDs are set in .env, so callers can disable the button. */
  available: boolean;
};

/**
 * Google sign-in for the auth screens.
 *
 * Google hands back an ID token, which Firebase exchanges for a session in
 * AuthContext. Routing is left to the existing onAuthStateChanged gate: a
 * returning user has a users/{uid} document and lands on Home, a new one does
 * not and lands in profile setup.
 *
 * Requires a development build. Expo Go serves every project under the exp://
 * scheme, which Google rejects as a redirect target.
 */
export function useGoogleSignIn(): GoogleSignIn {
  const { signInWithGoogle } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
    iosClientId,
    androidClientId,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      // Native Google requests exchange an authorization code before returning.
      // Expo places the resulting token on authentication as well as params.
      const idToken = response.authentication?.idToken ?? response.params.id_token;
      if (!idToken) {
        setPending(false);
        setError('Google did not return a sign-in token. Try again.');
        return;
      }
      let cancelled = false;
      signInWithGoogle(idToken)
        .catch(() => {
          if (!cancelled) setError('Could not finish signing in with Google. Try again.');
        })
        .finally(() => {
          if (!cancelled) setPending(false);
        });
      return () => {
        cancelled = true;
      };
    }

    setPending(false);
    // A dismissed browser is the user backing out, so it reports no error.
    if (response.type === 'error') {
      setError('Google sign-in failed. Check your connection and try again.');
    }
  }, [response, signInWithGoogle]);

  return {
    signIn: () => {
      if (!request || pending || clientIdForPlatform === unconfiguredClientId || isExpoGo) return;
      setError('');
      setPending(true);
      void promptAsync().catch(() => {
        setPending(false);
        setError('Could not open Google sign-in. Try again.');
      });
    },
    pending,
    error,
    available: Boolean(request) && clientIdForPlatform !== unconfiguredClientId && !isExpoGo,
  };
}
