import { useRef, useState } from 'react';
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
import { requestPasswordReset } from '@/features/auth/passwordReset';
import { AuthStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, radius, sizes, spacing, text } from '@/theme';

type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const busyRef = useRef(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSendLink = async () => {
    // Guard rapid taps before the pending state reaches the button.
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');

    const { sent: delivered, error: failure } = await requestPasswordReset(email);
    if (failure) setError(failure);
    else if (delivered) setSent(true);

    busyRef.current = false;
    setBusy(false);
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
            <Logo />

            <View style={styles.copy}>
              <Text style={styles.prompt}>
                {sent ? 'Check your email for the reset link' : 'Enter Email To Reset'}
              </Text>
            </View>

            {sent ? (
              <Text accessibilityRole="alert" style={styles.confirmation}>
                We sent a one-time link to {email.trim()}. Open it to choose a new password.
              </Text>
            ) : (
              <View style={styles.form}>
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
                  returnKeyType="go"
                  accessibilityLabel="Email address"
                  onSubmitEditing={onSendLink}
                  editable={!busy}
                  style={styles.input}
                />

                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send a one-time password reset link"
                  onPress={onSendLink}
                  disabled={busy}
                  style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={gradients.purpleAccent}
                    {...gradientDirection.horizontal}
                    style={styles.buttonFill}
                  >
                    <Text style={styles.buttonText}>{busy ? 'Sending...' : 'Send One-Time Link'}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )}

            <Pressable
              accessibilityRole="link"
              onPress={() => navigation.navigate('SignIn')}
              disabled={busy}
              style={({ pressed }) => [styles.signInLink, pressed && styles.pressed]}
            >
              <Text style={styles.signInText}>Sign In</Text>
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
  copy: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  // The frame sets this prompt at 16pt regular, one step above the 14pt body token.
  prompt: { ...text.body, fontSize: 16, color: colors.white, textAlign: 'center' },
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
  confirmation: {
    ...text.body,
    color: colors.white,
    textAlign: 'center',
  },
  signInLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    padding: spacing.xs,
  },
  signInText: {
    ...text.body,
    fontSize: 16,
    color: colors.primaryAccent,
    textDecorationLine: 'underline',
  },
  pressed: { opacity: 0.85 },
});
