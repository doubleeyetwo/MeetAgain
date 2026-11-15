import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ContinueButton } from '@/components/ContinueButton';
import {
  Dropdown,
  type DropdownOption,
} from '@/components/Dropdown';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontFamily, spacing } from '@/theme';
import { getGoogleCalendarSnapshot, type CalendarSnapshot } from '@/features/calendar/googleCalendar';
import { getDayAvailability } from '@/features/events/dayAvailability';

import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';
import {
  createDefaultRange,
  createDefaultTimes,
  formatDate,
  formatTime,
  getDateOptions,
  getTimeOptions,
  minutesOfDay,
  toDayKey,
  validateEventTimes,
  withDay,
  withTime,
  type EventTimes,
  type SelectableRange,
} from '@/features/events/eventTimes';

type Props = NativeStackScreenProps<
  EventCreationStackParamList,
  'PickTime'
>;

export function PickTimeScreen({
  navigation,
  route,
}: Props) {
  // Fixed when the screen opens so the options don't shift while the planner chooses.
  const [range] = useState(() => createDefaultRange());

  // The one copy of the event's time. When the heat map is added, its drag
  // should call setTimes too; the dropdowns then show whatever it picked.
  const [times, setTimes] = useState<EventTimes>(() => {
    const { startAt, endAt } = route.params;
    return startAt && endAt
      ? { start: new Date(startAt), end: new Date(endAt) }
      : createDefaultTimes(range);
  });

  const dateOptions = useMemo(
    () => getDateOptions(range),
    [range]
  );

  const error = validateEventTimes(times);

  const handleConfirmTime = () => {
  if (error) {
    return;
  }

  const { editingFromReview, ...details } = route.params;
  const params = {
    ...details,
    startAt: times.start.toISOString(),
    endAt: times.end.toISOString(),
  };
  if (editingFromReview) {
    navigation.navigate({ name: 'ReviewEvent', params, merge: true, pop: true });
    return;
  }
  navigation.navigate('PickLocation', params);
};

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Pick a Time"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <EventMonthCalendar initialDate={times.start} memberIds={route.params.selectedMemberIds} />

        <View style={styles.timeCard}>
          <TimeRow
            label="Start"
            value={times.start}
            range={range}
            dateOptions={dateOptions}
            onChange={(start) =>
              setTimes((current) => ({ ...current, start }))
            }
          />

          <TimeRow
            label="End"
            value={times.end}
            range={range}
            dateOptions={dateOptions}
            invalid={error !== null}
            onChange={(end) =>
              setTimes((current) => ({ ...current, end }))
            }
          />

          {error && (
            <Text
              style={styles.errorText}
              accessibilityRole="alert"
            >
              {error}
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.confirmContainer}>
        <ContinueButton
          title="Confirm Time"
          onPress={handleConfirmTime}
          disabled={error !== null}
        />
      </View>
    </View>
  );
}

const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const monthOptions = Array.from({ length: 12 }, (_, value) => ({
  value,
  label: new Date(2024, value, 1).toLocaleDateString('en-US', { month: 'long' }),
}));

function EventMonthCalendar({ initialDate, memberIds }: { initialDate: Date; memberIds: string[] }) {
  const [calendars, setCalendars] = useState<(CalendarSnapshot | null)[] | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setCalendars(null);
    // Read from the server so returning to this screen respects current sharing permissions.
    void Promise.all([...new Set(memberIds)].map((uid) =>
      getGoogleCalendarSnapshot(uid, 'server').catch(() => null)
    )).then((snapshots) => {
      if (active) setCalendars(snapshots);
    });
    return () => { active = false; };
  }, [memberIds]));
  const [month, setMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstYear = Math.min(initialDate.getFullYear(), year);
  const lastYear = Math.max(initialDate.getFullYear() + 4, year);
  const yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
    const value = firstYear + index;
    return { value, label: String(value) };
  });
  const leadingDays = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // Calendar coverage is continuous, so checking both ends covers the displayed month.
  const hasUnknownCalendars = calendars !== null && [1, daysInMonth].some((day) =>
    getDayAvailability(new Date(year, monthIndex, day), calendars).unknown > 0
  );
  const weekCount = Math.ceil((leadingDays + daysInMonth) / 7);
  const shiftMonth = (offset: number) => setMonth((current) =>
    new Date(current.getFullYear(), current.getMonth() + offset, 1)
  );

  return (
    <View style={styles.calendarCard}>
      <View style={styles.monthHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={styles.monthButton} onPress={() => shiftMonth(-1)}>
          <Ionicons name="chevron-back" size={19} color={colors.white} />
        </Pressable>
        <View style={styles.monthSelectors}>
          <Dropdown
            accessibilityLabel="Calendar month"
            displayText={monthOptions[monthIndex].label}
            options={monthOptions}
            value={monthIndex}
            onChange={(nextMonth) => setMonth(new Date(year, nextMonth, 1))}
            variant="heading"
          />
          <Dropdown
            accessibilityLabel="Calendar year"
            displayText={String(year)}
            options={yearOptions}
            value={year}
            onChange={(nextYear) => setMonth(new Date(nextYear, monthIndex, 1))}
            variant="heading"
          />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" style={styles.monthButton} onPress={() => shiftMonth(1)}>
          <Ionicons name="chevron-forward" size={19} color={colors.white} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {weekdays.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}
      </View>
      {Array.from({ length: weekCount }, (_, week) => (
        <View key={week} style={styles.week}>
          {weekdays.map((day, column) => {
            const date = new Date(year, monthIndex, week * 7 + column - leadingDays + 1);
            const availability = date.getMonth() === monthIndex && calendars
              ? getDayAvailability(date, calendars)
              : null;
            const shade = availability?.shade;
            const percent = availability?.freePercentage;
            const dateLabel = date.toLocaleDateString();
            const availabilityLabel = availability && percent != null
              ? `${dateLabel}, ${percent.toFixed(1)}% free together, ${availability.unknown} calendars unknown`
              : availability ? `${dateLabel}, availability unknown` : dateLabel;
            return (
              <View key={day} style={[styles.dayCell, shade && { backgroundColor: colors.freeDay[shade] }]}>
                <Text
                  accessibilityLabel={availabilityLabel}
                  style={[styles.dayNumber, date.getMonth() !== monthIndex && styles.outsideMonth]}
                >
                  {date.getDate()}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
      {hasUnknownCalendars && (
        <Text style={styles.availabilityLegend}>Some Calendars are unknown</Text>
      )}
    </View>
  );
}

type TimeRowProps = {
  label: string;
  value: Date;
  range: SelectableRange;
  dateOptions: DropdownOption<string>[];
  onChange: (value: Date) => void;
  invalid?: boolean;
};

function TimeRow({
  label,
  value,
  range,
  dateOptions,
  onChange,
  invalid = false,
}: TimeRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>

      <Dropdown
        accessibilityLabel={`${label} date`}
        displayText={formatDate(value)}
        options={dateOptions}
        value={toDayKey(value)}
        onChange={(dayKey) =>
          onChange(withDay(value, dayKey, range))
        }
        invalid={invalid}
        style={styles.dateDropdown}
      />

      <Dropdown
        accessibilityLabel={`${label} time`}
        displayText={formatTime(value)}
        options={getTimeOptions(range, toDayKey(value))}
        value={minutesOfDay(value)}
        onChange={(minutes) =>
          onChange(withTime(value, minutes, range))
        }
        invalid={invalid}
        style={styles.timeDropdown}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 13,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },

  calendarCard: {
    backgroundColor: colors.cardDarker,
    borderRadius: 19,
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginBottom: spacing.md,
    gap: 4,
  },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthSelectors: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  week: { flexDirection: 'row', gap: 4 },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 8, color: colors.white, fontFamily: fontFamily.semibold },
  dayCell: { flex: 1, aspectRatio: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  availabilityLegend: { color: colors.white, opacity: 0.75, fontFamily: fontFamily.regular, fontSize: 12, marginTop: spacing.xs },
  dayNumber: { color: colors.white, fontFamily: fontFamily.semibold, fontSize: 15 },
  outsideMonth: { opacity: 0.38 },

  timeCard: {
    borderRadius: 19,
    backgroundColor: colors.cardDarker,
    paddingHorizontal: 14,
    paddingVertical: 18,
    gap: 18,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  rowLabel: {
    width: 48,
    color: colors.white,
    fontFamily: fontFamily.regular,
    fontSize: 17,
  },

  dateDropdown: {
    flex: 1.25,
  },

  timeDropdown: {
    flex: 1,
  },

  errorText: {
    marginTop: -6,
    marginLeft: 48 + spacing.sm,
    color: colors.red,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },

  confirmContainer: {
    paddingHorizontal: 13,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
  },
});
