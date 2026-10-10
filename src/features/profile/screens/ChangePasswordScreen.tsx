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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useAuth } from '@/features/auth/AuthContext';
import { requestPasswordReset } from '@/features/auth/passwordReset';
import { ProfileStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, radius, sizes, spacing, text } from '@/theme';

type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList>;

const REQUIREMENTS = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'One number or symbol', test: (value: string) => /[^A-Za-z]/.test(value) },
];

const STRENGTH_SEGMENTS = 4;
const STRONG_LENGTH = 12;

/* The frame shows four segments but not the scale, so the three requirements each earn one
   and the fourth is reserved for a comfortably long password. */
function strengthScore(value: string): number {
  if (!value) return 0;
  const met = REQUIREMENTS.filter((requirement) => requirement.test(value)).length;
  return met === REQUIREMENTS.length && value.length >= STRONG_LENGTH ? STRENGTH_SEGMENTS : met;
}

function LabelledField(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
  autoComplete: 'current-password' | 'new-password';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={props.autoComplete}
        textContentType={props.autoComplete === 'current-password' ? 'password' : 'newPassword'}
        editable={props.editable}
        accessibilityLabel={props.label}
        style={styles.input}
      />
    </View>
  );
}

export function ChangePasswordScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const { user } = useAuth();
  const busyRef = useRef(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const score = strengthScore(newPassword);
  const unmet = REQUIREMENTS.filter((requirement) => !requirement.test(newPassword));

  const onUpdate = async () => {
    // The ref closes the same-tick double-tap window before React updates the disabled state.
    if (busyRef.current || !user?.email) return;

    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    if (unmet.length > 0) {
      setError('Your new password does not meet the requirements below.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Choose a password different from your current one.');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      // Firebase requires a recent sign-in before a password change, so reauthenticate first.
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword),
      );
      await updatePassword(user, newPassword);
      navigation.goBack();
    } catch (failure) {
      const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : undefined;
      switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          setError('Your current password is incorrect.');
          break;
        case 'auth/weak-password':
          setError('Choose a stronger password.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Wait a moment and try again.');
          break;
        case 'auth/network-request-failed':
          setError('Check your connection and try again.');
          break;
        default:
          setError('Could not update your password. Please try again.');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onForgotCurrent = async () => {
    if (busyRef.current || !user?.email) return;
    setError('');
    const { error: failure } = await requestPasswordReset(user.email);
    if (failure) setError(failure);
    else setNotice(`We sent a reset link to ${user.email}. Check your junk folder too.`);
  };

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to settings"
            hitSlop={12}
            onPress={() => navigation.goBack()}
            disabled={busy}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </Pressable>

          <Text style={styles.title}>Change Password</Text>

          {/* Balances the back chevron so the title stays centred. */}
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.shield}>
              <Ionicons name="shield-outline" size={28} color={colors.white} />
            </View>

            <LabelledField
              label="Current Password"
              value={currentPassword}
              onChangeText={(value) => {
                setCurrentPassword(value);
                if (error) setError('');
              }}
              editable={!busy}
              autoComplete="current-password"
            />

            <LabelledField
              label="New Password"
              value={newPassword}
              onChangeText={(value) => {
                setNewPassword(value);
                if (error) setError('');
              }}
              editable={!busy}
              autoComplete="new-password"
            />

            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`Password strength ${score} of ${STRENGTH_SEGMENTS}`}
              style={styles.strength}
            >
              {Array.from({ length: STRENGTH_SEGMENTS }, (_, index) => (
                <View
                  key={index}
                  style={[styles.segment, index < score && styles.segmentFilled]}
                />
              ))}
            </View>

            <LabelledField
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                if (error) setError('');
              }}
              editable={!busy}
              autoComplete="new-password"
            />

            <Text style={styles.requirementsTitle}>Your password must have:</Text>
            {REQUIREMENTS.map((requirement) => {
              const met = requirement.test(newPassword);
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

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            ) : null}
            {notice ? (
              <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Update password"
              onPress={onUpdate}
              disabled={busy}
              style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={gradients.purpleAccent}
                {...gradientDirection.horizontal}
                style={styles.buttonFill}
              >
                <Text style={styles.buttonText}>{busy ? 'Updating...' : 'Update Password'}</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send a reset link to your email"
              onPress={onForgotCurrent}
              disabled={busy}
              style={({ pressed }) => [styles.forgotLink, pressed && styles.pressed]}
            >
              <Text style={styles.forgotText}>Forgot your current Password?</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default ChangePasswordScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: { ...text.title, color: colors.white },
  headerSpacer: { width: 26 },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  shield: {
    alignSelf: 'center',
    width: 50,
    height: 50,
    borderRadius: 10,
    // One-off decorative tile; not a named Figma variable.
    backgroundColor: 'rgba(55,50,158,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  field: { marginTop: spacing.sm },
  label: { ...text.body, fontSize: 12, lineHeight: 16, color: colors.white, padding: spacing.sm },
  input: {
    ...text.body,
    height: sizes.controlHeight,
    borderRadius: radius.sm,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    color: colors.white,
  },
  strength: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  segment: { flex: 1, height: 6, borderRadius: 50, backgroundColor: colors.trackMuted },
  segmentFilled: { backgroundColor: colors.success },
  requirementsTitle: {
    ...text.body,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
    marginTop: spacing.xl,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: spacing.sm,
  },
  requirementLabel: { ...text.body, fontSize: 17, color: colors.white },
  error: { ...text.body, color: '#ff9aa8', textAlign: 'center', marginTop: spacing.md },
  notice: { ...text.body, color: colors.white, textAlign: 'center', marginTop: spacing.md },
  buttonShell: { marginTop: spacing.lg, borderRadius: 20, overflow: 'hidden' },
  buttonFill: { height: 57, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...text.body, color: colors.white },
  forgotLink: { alignSelf: 'center', marginTop: spacing.md, padding: spacing.xs },
  forgotText: { ...text.body, color: colors.primaryAccent },
  pressed: { opacity: 0.85 },
});
