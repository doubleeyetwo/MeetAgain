import { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { colors, gradientDirection, gradients, radius, sizes, spacing, text } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useAuth } from '@/features/auth/AuthContext';
import { PASSWORD_REQUIREMENTS } from '@/features/auth/passwordRules';

type PasswordRoute = RouteProp<AuthStackParamList, 'Password'>;
type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export function PasswordScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const { params } = useRoute<PasswordRoute>();
  const { setSignupDraft } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const onContinue = () => {
    if (PASSWORD_REQUIREMENTS.some((requirement) => !requirement.test(password))) {
      setError('Your password does not meet the requirements above.');
      return;
    }
    setError('');
    // AuthContext keeps this draft in memory so the password never enters navigation params or storage.
    setSignupDraft({ email: params.email, password });
    navigation.navigate('CreateProfile');
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
              style={styles.input}
            />

            <View style={styles.requirements}>
              <Text style={styles.requirementsTitle}>Your password must have:</Text>
              {PASSWORD_REQUIREMENTS.map((requirement) => {
                const met = requirement.test(password);
                return (
                  <View key={requirement.label} style={styles.requirement}>
                    <Ionicons
                      name={met ? 'checkmark-circle' : 'close-circle'}
                      size={24}
                      color={met ? colors.success : colors.trackMuted}
                    />
                    <Text style={styles.requirementLabel}>{requirement.label}</Text>
                  </View>
                );
              })}
            </View>

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={onContinue}
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
  
  requirements: { marginTop: spacing.md },
  requirementsTitle: { ...text.body, fontSize: 16, lineHeight: 22, color: colors.white },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: spacing.sm,
  },
  requirementLabel: { ...text.body, fontSize: 17, color: colors.white },
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
