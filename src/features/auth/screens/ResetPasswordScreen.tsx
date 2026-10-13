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
import { Logo } from '@/components/Logo';
import { checkResetLink, completePasswordReset } from '@/features/auth/passwordReset';
import { AuthStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, radius, sizes, spacing, text } from '@/theme';

type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;
type Step = 'link' | 'password' | 'done';

// Lets the user finish a reset inside the app, so expired and used links get specific messages.
export function ResetPasswordScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const busyRef = useRef(false);
  const [step, setStep] = useState<Step>('link');
  const [link, setLink] = useState('');
  // The verified one-time code lives only in memory, like the signup password draft.
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !busy });
  }, [navigation, busy]);

  const run = async (task: () => Promise<void>) => {
    // Guard rapid taps before the pending state reaches the button.
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onCheckLink = () => run(async () => {
    const result = await checkResetLink(link);
    if (result.error || !result.code) {
      setError(result.error ?? 'Could not check this link. Please try again.');
      return;
    }
    setCode(result.code);
    setEmail(result.email ?? '');
    setStep('password');
  });

  const onSavePassword = () => {
    // Match the signup rule so a reset cannot set a weaker password than registration allows.
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    return run(async () => {
      const result = await completePasswordReset(code, password);
      if (result.done) {
        setCode('');
        setPassword('');
        setConfirmPassword('');
        setStep('done');
        return;
      }
      setError(result.error ?? 'Could not update your password. Please try again.');
      if (result.linkUnusable) {
        setCode('');
        setLink('');
        setStep('link');
      }
    });
  };

  const onUseDifferentLink = () => {
    setCode('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setStep('link');
  };

  // Return to the existing sign-in screen rather than stacking a new one.
  const onSignIn = () => navigation.popTo('SignIn');

  const { prompt, action, onAction } = {
    link: { prompt: 'Paste The Link From Your Reset Email', action: 'Check Link', onAction: onCheckLink },
    password: { prompt: 'Choose A New Password', action: 'Save New Password', onAction: onSavePassword },
    done: { prompt: 'Your password has been updated', action: 'Back To Sign In', onAction: onSignIn },
  }[step];

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
            <Logo />

            <View style={styles.copy}>
              <Text style={styles.prompt}>{prompt}</Text>
              {step === 'link' ? (
                <Text style={styles.hint}>Use the newest reset email. Each link works once, for one hour.</Text>
              ) : null}
              {step === 'password' && email ? <Text style={styles.hint}>For {email}</Text> : null}
              {step === 'done' ? <Text style={styles.hint}>Sign in with your new password.</Text> : null}
            </View>

            <View style={styles.form}>
              {step === 'link' ? (
                <TextInput
                  value={link}
                  onChangeText={(value) => {
                    setLink(value);
                    if (error) setError('');
                  }}
                  placeholder="https://..."
                  placeholderTextColor={colors.white}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  accessibilityLabel="Password reset link"
                  onSubmitEditing={onCheckLink}
                  editable={!busy}
                  style={styles.input}
                />
              ) : null}

              {step === 'password' ? (
                <>
                  <TextInput
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      if (error) setError('');
                    }}
                    placeholder="New Password..."
                    placeholderTextColor={colors.white}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    accessibilityLabel="New password"
                    editable={!busy}
                    style={styles.input}
                  />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={(value) => {
                      setConfirmPassword(value);
                      if (error) setError('');
                    }}
                    placeholder="Confirm Password..."
                    placeholderTextColor={colors.white}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="go"
                    accessibilityLabel="Confirm new password"
                    onSubmitEditing={onSavePassword}
                    editable={!busy}
                    style={styles.input}
                  />
                </>
              ) : null}

              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={onAction}
                disabled={busy}
                style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={gradients.purpleAccent}
                  {...gradientDirection.horizontal}
                  style={styles.buttonFill}
                >
                  <Text style={styles.buttonText}>{busy ? 'Please wait...' : action}</Text>
                </LinearGradient>
              </Pressable>
            </View>

            {step === 'password' ? (
              <Pressable
                accessibilityRole="button"
                onPress={onUseDifferentLink}
                disabled={busy}
                style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}
              >
                <Text style={styles.textLinkLabel}>Use a different link</Text>
              </Pressable>
            ) : null}

            {step !== 'done' ? (
              <Pressable
                accessibilityRole="link"
                onPress={onSignIn}
                disabled={busy}
                style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}
              >
                <Text style={styles.textLinkLabel}>Sign In</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  copy: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  // Matches the 16pt prompt on the Forgot Password screen.
  prompt: { ...text.body, fontSize: 16, color: colors.white, textAlign: 'center' },
  hint: { ...text.body, color: colors.white, textAlign: 'center' },
  form: { gap: spacing.md },
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
    textAlign: 'center',
  },
  buttonShell: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  buttonFill: {
    height: sizes.controlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { ...text.body, color: colors.white },
  textLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    padding: spacing.xs,
  },
  textLinkLabel: {
    ...text.body,
    fontSize: 16,
    color: colors.primaryAccent,
    textDecorationLine: 'underline',
  },
  pressed: { opacity: 0.85 },
});
