import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';

// Complete browser redirects on web; native redirects return through the app.
WebBrowser.maybeCompleteAuthSession();

const clientId = Platform.select({
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});
const isExpoGo = Platform.OS !== 'web'
  && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function useGoogleSignIn() {
  const { signInWithGoogle } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  // The provider requires an ID during render. This placeholder prevents a
  // startup error, but the availability guard never permits using it to sign in.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: clientId || 'unconfigured-google-client-id',
  });
  const available = Boolean(clientId?.trim()) && Boolean(request) && !isExpoGo;

  useEffect(() => {
    if (!response) return;
    let active = true;

    if (response.type === 'success') {
      // Native requests exchange a code and return authentication.idToken;
      // web requests can return the ID token directly in the redirect params.
      const idToken = response.authentication?.idToken ?? response.params.id_token;
      if (!idToken) {
        setError('Google did not return a sign-in token. Try again.');
        setPending(false);
        return;
      }
      void signInWithGoogle(idToken)
        .catch(() => {
          if (active) setError('Could not finish signing in with Google. Try again.');
        })
        .finally(() => {
          if (active) setPending(false);
        });
    } else {
      setPending(false);
      // Closing the browser is a cancellation, not a sign-in failure.
      if (response.type === 'error') setError('Google sign-in failed. Please try again.');
    }

    return () => { active = false; };
  }, [response, signInWithGoogle]);

  return {
    available,
    pending,
    error,
    signIn: () => {
      if (!available || pending) return;
      setError('');
      setPending(true);
      void promptAsync().catch(() => {
        setPending(false);
        setError('Could not open Google sign-in. Try again.');
      });
    },
  };
}
