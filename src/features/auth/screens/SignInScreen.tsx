import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Logo } from '@/components/Logo';
import { auth } from '@/config/firebase';
import { useAuth } from '@/features/auth/AuthContext';
import { AuthStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, radius, sizes, spacing, text } from '@/theme';

type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export function SignInScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const { profilePending } = useAuth();
  const passwordInput = useRef<TextInput>(null);
  const busyRef = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !busy });
  }, [navigation, busy]);

  useEffect(() => {
    // An authenticated account without a saved profile must finish setup before entering the app.
    if (profilePending) navigation.navigate('CreateProfile');
  }, [navigation, profilePending]);

  const onSignIn = async () => {
    // Guard rapid taps before the pending state reaches the button.
    if (busyRef.current) return;
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      // AuthProvider checks for a profile before its auth state can switch to the main app.
    } catch (failure) {
      const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : undefined;
      switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          setError('Incorrect email or password. Please try again.');
          break;
        case 'auth/network-request-failed':
          setError('Check your connection and try again.');
          break;
        case 'auth/user-disabled':
          setError('This account is disabled. Please contact support.');
          break;
        default:
          setError('Could not sign in. Please try again.');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to registration"
              onPress={() => navigation.goBack()}
              disabled={busy}
              hitSlop={12}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Text style={styles.backChevron}>‹</Text>
            </Pressable>

            <Logo />

            <View style={styles.headings}>
              <Text style={styles.title}>Sign In to Account</Text>
            </View>

            <TextInput
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (error) setError('');
              }}
              placeholder="email@domain.com"
              placeholderTextColor={colors.white}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              accessibilityLabel="Email address"
              onSubmitEditing={() => passwordInput.current?.focus()}
              editable={!busy}
              style={styles.input}
            />

            <TextInput
              ref={passwordInput}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (error) setError('');
              }}
              placeholder="Enter Password..."
              placeholderTextColor={colors.white}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              accessibilityLabel="Password"
              onSubmitEditing={onSignIn}
              editable={!busy}
              style={[styles.input, styles.passwordInput]}
            />

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign into MeetAgain"
              onPress={onSignIn}
              disabled={busy}
              style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={gradients.purpleAccent}
                {...gradientDirection.horizontal}
                style={styles.buttonFill}
              >
                <Text style={styles.buttonText}>{busy ? 'Signing in...' : 'Sign Into MeetAgain'}</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              accessibilityRole="link"
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={busy}
              style={({ pressed }) => [styles.forgotLink, pressed && styles.pressed]}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default SignInScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  backButton: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.sm,
    zIndex: 1,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    color: colors.white,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '300',
  },
  headings: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  title: { ...text.header, color: colors.white },
  input: {
    ...text.body,
    height: sizes.controlHeight,
    borderRadius: radius.sm,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
    color: colors.white,
  },
  passwordInput: { marginTop: spacing.md },
  error: {
    ...text.body,
    color: '#ff9aa8',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  buttonShell: {
    marginTop: spacing.md,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  buttonFill: {
    height: sizes.controlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { ...text.body, color: colors.white },
  forgotLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    padding: spacing.xs,
  },
  forgotText: {
    ...text.body,
    color: colors.primaryAccent,
    textDecorationLine: 'underline',
  },
  pressed: { opacity: 0.85 },
});
