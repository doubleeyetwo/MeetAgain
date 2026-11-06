import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Google from 'expo-auth-session/providers/google';
import { exchangeCodeAsync } from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/features/auth/AuthContext';
import { deleteAccount } from '@/features/profile/deleteAccount';
import { disconnectGoogleCalendar, getGoogleCalendarSnapshot, importGoogleCalendar } from '@/features/calendar/googleCalendar';
import { clearAllGoogleCalendarTokens, getGoogleCalendarToken, rememberGoogleCalendarToken } from '@/features/calendar/googleCalendarTokenCache';
import { ProfileStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, radius, spacing, text } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

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

type PillProps = { label: string; color: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean };

function PillButton({ label, color, onPress, icon, disabled }: PillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={20} color={color} style={styles.pillIcon} /> : null}
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const { user, signOut } = useAuth();
  const googleClientIds = {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  };
  const googleClientId = Platform.select({
    ios: googleClientIds.iosClientId,
    android: googleClientIds.androidClientId,
    default: googleClientIds.webClientId,
  });
  const [googleRequest, , promptGoogle] = Google.useAuthRequest({
    clientId: googleClientId?.trim() || 'unconfigured-google-client-id',
    scopes: ['https://www.googleapis.com/auth/calendar.freebusy'],
    selectAccount: true,
    shouldAutoExchangeCode: false,
  });
  const busyRef = useRef(false);
  const confirmationOpen = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [calendarImported, setCalendarImported] = useState(false);
  const [calendarLastUpdated, setCalendarLastUpdated] = useState<Date | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const calendarStatusRequest = useRef(0);
  const previousUserId = useRef(user?.uid ?? null);

  useEffect(() => {
    const currentUserId = user?.uid ?? null;
    if (previousUserId.current !== currentUserId) clearAllGoogleCalendarTokens();
    previousUserId.current = currentUserId;
  }, [user?.uid]);

  const refreshCalendarStatus = useCallback(async () => {
    const requestId = ++calendarStatusRequest.current;
    setCalendarLoading(true);
    try {
      const snapshot = user ? await getGoogleCalendarSnapshot(user.uid) : null;
      if (calendarStatusRequest.current !== requestId) return;
      setCalendarImported(snapshot !== null);
      setCalendarLastUpdated(snapshot?.lastUpdated ?? null);
    } catch (failure) {
      if (calendarStatusRequest.current !== requestId) return;
      setError(failure instanceof Error ? failure.message : 'Could not check Google Calendar status.');
    } finally {
      if (calendarStatusRequest.current === requestId) setCalendarLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    void refreshCalendarStatus();
  }, [refreshCalendarStatus]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshCalendarStatus();
    });
    return () => subscription.remove();
  }, [refreshCalendarStatus]);

  const onToggleGoogleCalendar = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (!user) throw new Error('Sign in to MeetAgain before importing a calendar.');
      if (Platform.OS !== 'web' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        throw new Error('Google Calendar import needs a development build on iOS or Android. You can still view a saved snapshot in Expo Go.');
      }
      if (!googleClientId?.trim()) throw new Error('Google Calendar sign-in is not configured. Add the platform OAuth client ID in your setup.');
      let accessToken = getGoogleCalendarToken(user.uid);
      if (!accessToken) {
        if (!googleRequest) throw new Error('Google Calendar sign-in is not ready. Try again.');
        const authResult = await promptGoogle();
        if (authResult.type === 'cancel' || authResult.type === 'dismiss') return;
        if (authResult.type !== 'success') throw new Error('Google Calendar sign-in failed. Try again.');
        accessToken = authResult.authentication?.accessToken ?? null;
        let expiresIn = authResult.authentication?.expiresIn;
        const code = authResult.params.code;
        if (!accessToken && typeof code === 'string' && Platform.OS !== 'web') {
          const nativeClientId = Platform.OS === 'ios' ? googleClientIds.iosClientId : googleClientIds.androidClientId;
          if (!nativeClientId || !googleRequest.codeVerifier || !googleRequest.redirectUri) throw new Error('Google Calendar sign-in could not be completed. Check your native OAuth setup.');
          const token = await exchangeCodeAsync({
            clientId: nativeClientId,
            code,
            redirectUri: googleRequest.redirectUri,
            extraParams: { code_verifier: googleRequest.codeVerifier },
          }, Google.discovery);
          accessToken = token.accessToken;
          expiresIn = token.expiresIn;
        }
        if (!accessToken) throw new Error('Google did not provide calendar access. Try again.');
        rememberGoogleCalendarToken(user.uid, accessToken, expiresIn);
      }
      await importGoogleCalendar(user.uid, accessToken);
      await refreshCalendarStatus();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update Google Calendar connection.');
      await refreshCalendarStatus();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onDisconnectGoogleCalendar = async () => {
    if (busyRef.current || !user) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await disconnectGoogleCalendar(user.uid);
      setCalendarImported(false);
      setCalendarLastUpdated(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not remove the saved calendar snapshot.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onLogOut = async () => {
    // The ref closes the same-tick double-tap window before React updates the disabled state.
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await signOut();
      clearAllGoogleCalendarTokens();
    } catch {
      setError('Could not log out. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onDeleteAccount = () => {
    if (busyRef.current || confirmationOpen.current || !user) return;
    confirmationOpen.current = true;
    const message = 'Permanently delete your account, profile, and friendships? This cannot be undone.';
    if (Platform.OS === 'web') {
      const confirmed = globalThis.confirm(message);
      confirmationOpen.current = false;
      if (confirmed) void confirmDeleteAccount();
      return;
    }
    Alert.alert('Delete Account', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => { confirmationOpen.current = false; } },
      { text: 'Delete', style: 'destructive', onPress: () => {
        confirmationOpen.current = false;
        void confirmDeleteAccount();
      } },
    ]);
  };

  const confirmDeleteAccount = async () => {
    if (busyRef.current || !user) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await deleteAccount(user);
      clearAllGoogleCalendarTokens();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not finish deleting your account. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
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
              label={calendarLoading ? 'Checking saved calendar...' : calendarImported ? 'Connected / Refresh Google Calendar' : 'Import Google Calendar'}
              color={calendarImported ? colors.success : colors.fieldLabel}
              onPress={onToggleGoogleCalendar}
              disabled={busy || calendarLoading}
            />
            <Text style={styles.calendarStatus}>
              {calendarImported
                ? `Saved busy-time snapshot${calendarLastUpdated ? ` · updated ${calendarLastUpdated.toLocaleString()}` : ''}.`
                : 'No calendar snapshot saved.'}
            </Text>
            <Text style={styles.calendarHint}>Imports the next 4 months of calendar data.</Text>
            {calendarImported ? <PillButton label="Disconnect Google Calendar" color={colors.linkAccent} onPress={onDisconnectGoogleCalendar} disabled={busy || calendarLoading} /> : null}
            <PillButton label="Log Out" color={colors.danger} onPress={onLogOut} disabled={busy} />
            <PillButton
              label={busy ? 'Please wait...' : 'Delete Account'}
              color={colors.danger}
              onPress={onDeleteAccount}
              disabled={busy}
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
  calendarStatus: { ...text.body, color: colors.white, opacity: 0.72, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: spacing.md },
  calendarHint: { ...text.body, color: colors.white, opacity: 0.56, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: spacing.md },
  statusRefresh: { alignItems: 'center', paddingVertical: spacing.xs },
  statusRefreshText: { ...text.body, color: colors.linkAccent, fontSize: 13 },
  pressed: { opacity: 0.85 },
});
