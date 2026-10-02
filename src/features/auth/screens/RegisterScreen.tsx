// import { Text } from 'react-native'; import { Screen } from '@/components/Screen';
// export function RegisterScreen() { return <Screen title="Create account"><Text>Registration form placeholder.</Text></Screen>; }

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, gradientDirection, spacing, radius, sizes, text } from '@/theme';
import { Logo, GoogleIcon } from '@/components/Logo';

const TERMS_URL = 'https://example.com/terms'; // TODO: replace
const PRIVACY_URL = 'https://example.com/privacy'; // TODO: replace

export function RegisterScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');

  const onContinue = (value: string) => console.log('continue', value); // TODO
  const onGoogle = () => console.log('google'); // TODO
  const onSignIn = () => navigation.goBack(); // TODO: go to your sign-in screen

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Logo />

            <View style={styles.headings}>
              <Text style={styles.title}>Create an account</Text>
              <Text style={styles.subtitle}>Enter your email to make an account</Text>
            </View>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email@domain.com"
              placeholderTextColor={colors.white}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              style={styles.input}
            />

            <Pressable
              onPress={() => onContinue(email.trim())}
              style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={gradients.purpleAccent}
                {...gradientDirection.horizontal}
                style={styles.buttonFill}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={onGoogle}
              style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
            >
              <GoogleIcon />
              <Text style={styles.buttonText}>Continue with Google</Text>
            </Pressable>

            <Text style={styles.legal}>
              By clicking continue, you agree to our{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_URL) }>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
                Privacy Policy
              </Text>
            </Text>

            <Text style={styles.signInRow}>
              Have an account?{' '}
              <Text style={styles.signInLink} onPress={onSignIn}>
                Sign In
              </Text>
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default RegisterScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },

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

  buttonShell: { marginTop: spacing.md, borderRadius: radius.sm, overflow: 'hidden' },
  buttonFill: { height: sizes.controlHeight, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...text.body, color: colors.white },
  pressed: { opacity: 0.85 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg, gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.primaryAccent },
  dividerText: { ...text.body, color: colors.white },

  googleButton: {
    height: sizes.controlHeight,
    borderRadius: radius.sm,
    backgroundColor: colors.cardLighter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  legal: {
    ...text.body,
    lineHeight: 18,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
    color: colors.white,
  },
  legalLink: { color: colors.primaryAccent, textDecorationLine: 'underline' },

  signInRow: { ...text.body, marginTop: spacing.xl, textAlign: 'center', color: colors.white },
  signInLink: { color: colors.primaryAccent, textDecorationLine: 'underline' },
});