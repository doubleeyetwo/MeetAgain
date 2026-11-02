import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ContinueButton } from '@/components/ContinueButton';
import {
  Dropdown,
  type DropdownOption,
} from '@/components/Dropdown';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontFamily, spacing } from '@/theme';

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
  const [times, setTimes] = useState<EventTimes>(() =>
    createDefaultTimes(range)
  );

  const dateOptions = useMemo(
    () => getDateOptions(range),
    [range]
  );

  const error = validateEventTimes(times);

  const handleConfirmTime = () => {
  if (error) {
    return;
  }

  navigation.navigate('SelectMembers', {
    ...route.params,
    startAt: times.start.toISOString(),
    endAt: times.end.toISOString(),
  });
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
        {/* The availability calendar and heat map go above the time card. */}

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
