import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/features/auth/AuthContext';
import { getCalendarSharing, setCalendarSharing } from '@/features/calendar/googleCalendar';
import type { ProfileStackParamList } from '@/navigation/types';
import { colors, gradients, spacing, text } from '@/theme';

export function PrivacySettingsScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'PrivacySettings'>) {
  const uid = useAuth().user?.uid;
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const writePending = useRef(false);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    setSharing(null);
    setError('');
    void getCalendarSharing(uid).then(
      (enabled) => { if (active) setSharing(enabled); },
      () => { if (active) setError('Could not load calendar sharing. Reopen Privacy Settings to retry.'); },
    );
    return () => { active = false; };
  }, [uid]);

  async function updateSharing(enabled: boolean) {
    if (!uid || sharing === null || writePending.current) return;
    writePending.current = true;
    setSaving(true);
    setError('');
    try {
      await setCalendarSharing(uid, enabled);
      setSharing(enabled);
    } catch {
      setError('Could not update calendar sharing. Try again.');
    } finally {
      writePending.current = false;
      setSaving(false);
    }
  }

  return (
    <LinearGradient colors={gradients.background} style={styles.screen}>
      <ScreenHeader title="Privacy Settings" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.label}>Free Now Visibility</Text>
          <Switch accessibilityLabel="Free Now Visibility" value={false} disabled />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Make Calendar Private</Text>
          <Switch accessibilityLabel="Make Calendar Private" value={false} disabled />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Share Calendar Availability</Text>
          <Switch
            accessibilityLabel="Share my busy/free times with accepted friends for event planning"
            value={sharing === true}
            disabled={!uid || sharing === null || saving}
            onValueChange={updateSharing}
            trackColor={{ true: colors.primaryAccent }}
          />
        </View>
        <Text style={styles.hint}>Accepted friends can see your busy/free times when planning events.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  label: { ...text.body, fontSize: 16, color: colors.white, flex: 1 },
  hint: { ...text.body, color: colors.white, opacity: 0.72, paddingHorizontal: spacing.md },
  error: { ...text.body, color: '#ff9aa8', paddingHorizontal: spacing.md },
});
