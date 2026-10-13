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
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Logo } from '@/components/Logo';
import { auth } from '@/config/firebase';
import { AuthStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, radius, sizes, spacing, text } from '@/theme';

type ForgotPasswordRoute = RouteProp<AuthStackParamList, 'ForgotPassword'>;
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const { params } = useRoute<ForgotPasswordRoute>();
  const busyRef = useRef(false);
  // If the user typed in info on the sign-in screen, it carries over to this screen.
  const [email, setEmail] = useState(params?.email ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !busy });
  }, [navigation, busy]);

  const onSendReset = async () => {
    // Guard rapid taps before the pending state reaches the button.
    if (busyRef.current) return;
    const normalizedEmail = email.trim();
    // Reject malformed addresses here so no request reaches Firebase.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      // Firebase emails a link to its hosted page, where the new password is set and the old one stops working.
      await sendPasswordResetEmail(auth, normalizedEmail);
      // Replace this screen so Back from the confirmation returns to sign-in instead of the form.
      navigation.replace('ResetPasswordSent', { email: normalizedEmail });
    } catch (failure) {
      const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : undefined;
      switch (code) {
        case 'auth/invalid-email':
        case 'auth/missing-email':
          setError('Enter a valid email address.');
          break;
        // Only returned when email enumeration protection is turned off in the Firebase console.
        case 'auth/user-not-found':
          setError('No account uses that email. Check it for typos or create a new account.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please wait a few minutes and try again.');
          break;
        case 'auth/network-request-failed':
          setError('Check your connection and try again.');
          break;
        default:
          setError('Could not send the reset email. Please try again.');
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
              accessibilityLabel="Back to sign in"
              onPress={() => navigation.goBack()}
              disabled={busy}
              hitSlop={12}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Text style={styles.backChevron}>‹</Text>
            </Pressable>

            <Logo />

            <View style={styles.headings}>
              <Text style={styles.title}>Reset password</Text>
              <Text style={styles.subtitle}>Enter your account email and we'll send you a reset link</Text>
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
              returnKeyType="send"
              accessibilityLabel="Email address"
              onSubmitEditing={onSendReset}
              editable={!busy}
              style={styles.input}
            />

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            ) : null}

            <Pressable
<<<<<<< Updated upstream
              accessibilityRole="button"
              accessibilityLabel="Send password reset link"
              onPress={onSendReset}
=======
              accessibilityRole="link"
              onPress={() => navigation.navigate('ResetPassword')}
              disabled={busy}
              style={({ pressed }) => [styles.signInLink, pressed && styles.pressed]}
            >
              <Text style={styles.signInText}>Already have a reset link?</Text>
            </Pressable>

            <Pressable
              accessibilityRole="link"
              onPress={() => navigation.navigate('SignIn')}
>>>>>>> Stashed changes
              disabled={busy}
              style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={gradients.purpleAccent}
                {...gradientDirection.horizontal}
                style={styles.buttonFill}
              >
                <Text style={styles.buttonText}>{busy ? 'Sending...' : 'Send Reset Link'}</Text>
              </LinearGradient>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default ForgotPasswordScreen;

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
    gap: spacing.xs,
  },
  title: { ...text.header, color: colors.white },
  subtitle: { ...text.body, color: colors.white, textAlign: 'center' },
  input: {
    ...text.body,
    height: sizes.controlHeight,
    borderRadius: radius.sm,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
    color: colors.white,
  },
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
  pressed: { opacity: 0.85 },
});
