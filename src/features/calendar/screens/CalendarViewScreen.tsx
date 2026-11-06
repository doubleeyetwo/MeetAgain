import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, text } from '@/theme';
import { BusyInterval, getGoogleCalendarSnapshot } from '@/features/calendar/googleCalendar';
import { useAuth } from '@/features/auth/AuthContext';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function offsetDate(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function localMidnight(date: string) {
  return new Date(`${date}T00:00:00`);
}

function isValidInputDate(value: string) {
  return DATE_PATTERN.test(value) && Number.isFinite(localMidnight(value).getTime()) && formatDateInput(localMidnight(value)) === value;
}

function buildTimeline(start: Date, end: Date, busy: BusyInterval[]) {
  const clipped = busy.map(({ start: busyStart, end: busyEnd }) => ({
    start: Math.max(start.getTime(), Date.parse(busyStart)),
    end: Math.min(end.getTime(), Date.parse(busyEnd)),
  })).filter((block) => block.start < block.end).sort((a, b) => a.start - b.start);
  const merged = clipped.reduce<{ start: number; end: number }[]>((result, block) => {
    const last = result[result.length - 1];
    if (last && block.start <= last.end) last.end = Math.max(last.end, block.end);
    else result.push({ ...block });
    return result;
  }, []);
  const timeline: { kind: 'busy' | 'free'; start: number; end: number }[] = [];
  let cursor = start.getTime();
  for (const block of merged) {
    if (cursor < block.start) timeline.push({ kind: 'free', start: cursor, end: block.start });
    timeline.push({ kind: 'busy', ...block });
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < end.getTime()) timeline.push({ kind: 'free', start: cursor, end: end.getTime() });
  return timeline;
}

export function CalendarViewScreen() {
  const { user } = useAuth();
  const today = formatDateInput(new Date());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(formatDateInput(offsetDate(new Date(), 6)));
  const [imported, setImported] = useState<boolean | null>(null);
  const [availability, setAvailability] = useState<{ startDate: string; endDate: string; busy: BusyInterval[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadingRef = useRef(false);
  const availabilityRequest = useRef(0);

  const updateStartDate = (value: string) => {
    availabilityRequest.current += 1;
    setAvailability(null);
    setStartDate(value);
  };
  const updateEndDate = (value: string) => {
    availabilityRequest.current += 1;
    setAvailability(null);
    setEndDate(value);
  };

  const refreshConnection = useCallback(async () => {
    try {
      const snapshot = user ? await getGoogleCalendarSnapshot(user.uid) : null;
      setImported(snapshot !== null);
      if (!snapshot) setAvailability(null);
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not check Google Calendar status.');
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void refreshConnection(); }, [refreshConnection]));

  const loadAvailability = async () => {
    if (loadingRef.current) return;
    setError('');
    setAvailability(null);
    if (imported !== true || !user) {
      setError(imported === false ? 'Import Google Calendar from Settings to check availability.' : 'Check your saved calendar snapshot and try again.');
      return;
    }
    if (!isValidInputDate(startDate) || !isValidInputDate(endDate)) {
      setError('Enter dates in YYYY-MM-DD format.');
      return;
    }
    const start = localMidnight(startDate);
    const endExclusive = offsetDate(localMidnight(endDate), 1);
    const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = Date.UTC(localMidnight(endDate).getFullYear(), localMidnight(endDate).getMonth(), localMidnight(endDate).getDate());
    const dayCount = (endDay - startDay) / (24 * 60 * 60 * 1000) + 1;
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(endExclusive.getTime()) || dayCount <= 0) {
      setError('Choose an end date after the start date.');
      return;
    }
    loadingRef.current = true;
    const requestId = ++availabilityRequest.current;
    setLoading(true);
    try {
      const snapshot = await getGoogleCalendarSnapshot(user.uid);
      if (!snapshot) throw new Error('Import Google Calendar from Settings to check availability.');
      if (start < snapshot.rangeStart || endExclusive > snapshot.rangeEnd) {
        throw new Error('Choose dates within the saved snapshot, then import again from Settings to refresh it.');
      }
      if (availabilityRequest.current === requestId) setAvailability({ startDate, endDate, busy: snapshot.busy });
    } catch (failure) {
      if (availabilityRequest.current === requestId) setError(failure instanceof Error ? failure.message : 'Could not load availability.');
      if (failure instanceof Error && failure.message.toLowerCase().includes('import google calendar')) setImported(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const start = availability ? localMidnight(availability.startDate) : new Date(NaN);
  const end = availability ? offsetDate(localMidnight(availability.endDate), 1) : new Date(NaN);
  const timeline = availability && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
    ? buildTimeline(start, end, availability.busy)
    : [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Calendar</Text>
      <Text style={styles.description}>Check busy and free time from your saved Google Calendar snapshot.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Start date</Text>
        <TextInput value={startDate} onChangeText={updateStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.white} style={styles.input} accessibilityLabel="Start date" />
        <Text style={styles.label}>End date</Text>
        <TextInput value={endDate} onChangeText={updateEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.white} style={styles.input} accessibilityLabel="End date" />
        <Pressable accessibilityRole="button" onPress={loadAvailability} disabled={loading} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Check availability</Text>}
        </Pressable>
      </View>
      {imported === false ? <Text style={styles.hint}>Import Google Calendar from Settings first.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {availability !== null ? (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>Availability</Text>
          {timeline.length ? timeline.map((interval, index) => (
            <View key={`${interval.start}-${interval.end}-${index}`} style={[styles.interval, interval.kind === 'busy' ? styles.busyInterval : styles.freeInterval]}>
              <Text style={styles.intervalLabel}>{interval.kind === 'busy' ? 'Busy' : 'Free'}</Text>
              <Text style={styles.intervalTime}>{formatTime(new Date(interval.start).toISOString())} – {formatTime(new Date(interval.end).toISOString())}</Text>
            </View>
          )) : <Text style={styles.hint}>No busy intervals were found; this date range is free on your primary calendar.</Text>}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { ...text.title, color: colors.white, marginBottom: spacing.xs },
  description: { ...text.body, color: colors.white, opacity: 0.75, marginBottom: spacing.lg },
  card: { backgroundColor: colors.cardDarker, borderRadius: 14, padding: spacing.md, gap: spacing.sm },
  label: { ...text.body, color: colors.white, fontSize: 14 },
  input: { ...text.body, color: colors.white, borderColor: '#657080', borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  button: { alignItems: 'center', backgroundColor: colors.linkAccent, borderRadius: 24, padding: spacing.sm, marginTop: spacing.sm },
  buttonText: { ...text.body, color: colors.white, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  hint: { ...text.body, color: colors.white, opacity: 0.72, marginTop: spacing.md },
  error: { ...text.body, color: '#ff9aa8', marginTop: spacing.md },
  results: { marginTop: spacing.lg, gap: spacing.sm },
  resultsTitle: { ...text.body, color: colors.white, fontSize: 18, fontWeight: '600', marginBottom: spacing.xs },
  interval: { borderRadius: 10, padding: spacing.sm, gap: 2 },
  busyInterval: { backgroundColor: '#73414d' },
  freeInterval: { backgroundColor: '#285b50' },
  intervalLabel: { ...text.body, color: colors.white, fontWeight: '700' },
  intervalTime: { ...text.body, color: colors.white, fontSize: 13 },
});
