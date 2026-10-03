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
import { Logo } from '@/components/Logo';
import { colors, gradientDirection, gradients, radius, sizes, spacing, text } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useAuth } from '@/features/auth/AuthContext';
import { FirebaseError } from 'firebase/app';

type PasswordRoute = RouteProp<AuthStackParamList, 'Password'>;
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export function PasswordScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const { params } = useRoute<PasswordRoute>();
  const { createAccount, profilePending } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !busy && !profilePending });
  }, [navigation, busy, profilePending]);

  const onContinue = async () => {
    if (busyRef.current) return;
    if (!profilePending && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await createAccount(params.email, password);
    } catch (failure) {
      if (failure instanceof FirebaseError) {
        switch (failure.code) {
          case 'auth/email-already-in-use':
            setError('An account already uses this email. Go back and choose another email.');
            break;
          case 'auth/invalid-email':
            setError('This email address is invalid. Go back and correct it.');
            break;
          case 'auth/weak-password':
            setError('Choose a stronger password and try again.');
            break;
          case 'auth/network-request-failed':
            setError('Check your connection and try again.');
            break;
          case 'auth/operation-not-allowed':
            setError('Email and password signup is not enabled in Firebase yet.');
            break;
          default:
            setError('Could not create your account. Please try again.');
        }
      } else {
        setError(failure instanceof Error ? failure.message : 'Could not create your account. Please try again.');
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
              accessibilityLabel="Back to email"
              onPress={() => navigation.goBack()}
              disabled={busy || profilePending}
              hitSlop={12}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Text style={styles.backChevron}>‹</Text>
            </Pressable>

            <Logo />

            <View style={styles.headings}>
              <Text style={styles.title}>Create an account</Text>
              <Text style={styles.subtitle}>Create a new password</Text>
            </View>

            <TextInput
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
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              accessibilityLabel={`Password for ${params.email}`}
              onSubmitEditing={onContinue}
              editable={!busy && !profilePending}
              style={styles.input}
            />

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              onPress={onContinue}
              disabled={busy}
              style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={gradients.purpleAccent}
                {...gradientDirection.horizontal}
                style={styles.buttonFill}
              >
                <Text style={styles.buttonText}>{busy ? (profilePending ? 'Saving profile...' : 'Creating account...') : profilePending ? 'Retry' : 'Continue'}</Text>
              </LinearGradient>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default PasswordScreen;

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
  backChevron: { color: colors.white, fontSize: 38, lineHeight: 40, fontWeight: '300' },
  headings: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.lg, gap: spacing.xs },
  title: { ...text.header, color: colors.white },
  subtitle: { ...text.body, color: colors.white },
  input: {
    ...text.body,
    height: sizes.controlHeight,
    borderRadius: radius.sm,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
    color: colors.white,
  },
  error: { ...text.body, color: '#ff9aa8', marginTop: spacing.xs, textAlign: 'center' },
  buttonShell: { marginTop: spacing.md, borderRadius: radius.sm, overflow: 'hidden' },
  buttonFill: { height: sizes.controlHeight, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...text.body, color: colors.white },
  pressed: { opacity: 0.85 },
});
