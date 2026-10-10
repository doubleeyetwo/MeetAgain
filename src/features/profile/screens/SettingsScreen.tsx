import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { ProfileStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, radius, spacing, text } from '@/theme';

type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList>;

const CARD_RADIUS = 14;
const PILL_RADIUS = 120;

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

function SettingsRow({ icon, label, onPress, disabled }: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={colors.white} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={22} color={colors.white} />
    </Pressable>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

type PillProps = { label: string; color: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };

function PillButton({ label, color, onPress, icon }: PillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={20} color={color} style={styles.pillIcon} /> : null}
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const busyRef = useRef(false);
  const [error, setError] = useState('');

  const onLogOut = async () => {
    // The ref closes the same-tick double-tap window before React updates the disabled state.
    if (busyRef.current) return;
    busyRef.current = true;
    setError('');
    try {
      await signOut(auth);
    } catch {
      setError('Could not log out. Please try again.');
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            hitSlop={12}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </Pressable>

          <Text style={styles.title}>Settings</Text>

          {/* Balances the back chevron so the title stays centred. */}
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SettingsCard title="ACCOUNT">
            <SettingsRow
              icon="create-outline"
              label="Edit Profile"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <SettingsRow
              icon="lock-closed-outline"
              label="Change Password"
              onPress={() => navigation.navigate('ChangePassword')}
            />
          </SettingsCard>

          <SettingsCard title="NOTIFICATIONS">
            <SettingsRow
              icon="notifications-outline"
              label="Notification Settings"
              // Destination is Manage Notifications (#36).
              onPress={() => {}}
            />
          </SettingsCard>

          <SettingsCard title="PRIVACY">
            <SettingsRow
              icon="eye-off-outline"
              label="Privacy Settings"
              // Destination is Calendar Privacy (#37).
              onPress={() => {}}
            />
          </SettingsCard>

          <View style={styles.pills}>
            <PillButton
              icon="calendar-outline"
              label="Integrate Google Calendar"
              color={colors.linkAccent}
              // Destination is Google Calendar Integration (#44).
              onPress={() => {}}
            />
            <PillButton label="Log Out" color={colors.danger} onPress={onLogOut} />
            <PillButton
              label="Deactivate Account"
              color={colors.danger}
              // Deliberately inert: deleting an account is irreversible and has no issue or
              // agreed behaviour yet. Wire it only once that is specified.
              onPress={() => {}}
            />
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default SettingsScreen;

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
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.cardDarker,
    borderRadius: CARD_RADIUS,
    marginBottom: spacing.sm + 2,
    paddingBottom: spacing.xs,
  },
  cardTitle: {
    ...text.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.white,
    padding: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  rowLabel: { ...text.body, fontSize: 16, lineHeight: 24, color: colors.white, flex: 1 },
  pills: { marginTop: spacing.lg, gap: spacing.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardDarker,
    borderRadius: PILL_RADIUS,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
  },
  pillIcon: { marginRight: spacing.xs },
  pillLabel: { ...text.body, fontSize: 16, lineHeight: 24 },
  error: { ...text.body, color: '#ff9aa8', textAlign: 'center', marginTop: spacing.md },
  pressed: { opacity: 0.85 },
});
