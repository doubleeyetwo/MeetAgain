
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Timestamp } from 'firebase/firestore';

import { ContinueButton } from '@/components/ContinueButton';
import {
  Dropdown,
  type DropdownOption,
} from '@/components/Dropdown';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  colors,
  fontFamily,
  spacing,
  gradients,
  gradientDirection,
} from '@/theme';

import { auth } from '@/config/firebase';
import { saveEventDetails } from '@/features/events/eventEditingService';

import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';
import type { AppStackParamList } from '@/navigation/types';

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

type CreationProps = NativeStackScreenProps<
  EventCreationStackParamList,
  'PickTime'
>;

type EditingProps = NativeStackScreenProps<
  AppStackParamList,
  'EditEventTime'
>;

type ScreenProps =
  | { mode: 'create'; screen: CreationProps }
  | { mode: 'edit'; screen: EditingProps };

export function PickTimeScreen(props: CreationProps) {
  return <TimeForm mode="create" screen={props} />;
}

export function EditEventTimeScreen(props: EditingProps) {
  return <TimeForm mode="edit" screen={props} />;
}

function TimeForm(props: ScreenProps) {
  const isEditing = props.mode === 'edit';
  const params = props.screen.route.params;

  // Keep the available dates stable while this screen is open.
  const [range] = useState(() => createDefaultRange());

  const [times, setTimes] = useState<EventTimes>(() => {
    if (isEditing && params.startAt && params.endAt) {
      const start = new Date(params.startAt);
      const end = new Date(params.endAt);

      if (
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime())
      ) {
        return { start, end };
      }
    }

    return createDefaultTimes(range);
  });

  const [saving, setSaving] = useState(false);

  const dateOptions = useMemo(
    () => getDateOptions(range),
    [range]
  );

  const error = validateEventTimes(times);

  const handleConfirmTime = async () => {
    if (error || saving) return;

    if (props.mode === 'edit') {
      const actorId = auth.currentUser?.uid;

      if (!actorId) {
        Alert.alert(
          'Sign In Required',
          'Please sign in before editing this event.'
        );
        return;
      }

      setSaving(true);

      try {
        await saveEventDetails(
          props.screen.route.params.editingEventId,
          actorId,
          {
            startAt: Timestamp.fromDate(times.start),
            endAt: Timestamp.fromDate(times.end),
          }
        );

        props.screen.navigation.goBack();
      } catch (error) {
        Alert.alert(
          'Unable to Save',
          error instanceof Error
            ? error.message
            : 'Please try again.'
        );
      } finally {
        setSaving(false);
      }

      return;
    }

    const { navigation, route } = props.screen;

    navigation.navigate('SelectMembers', {
      ...route.params,
      startAt: times.start.toISOString(),
      endAt: times.end.toISOString(),
    });
  };

  return (
    <LinearGradient
      colors={gradients.background}
      {...gradientDirection.vertical}
      style={styles.screen}
    >
      <ScreenHeader
        title={
          isEditing
            ? 'Edit Event Time'
            : 'Pick a Time'
        }
        onBack={() => props.screen.navigation.goBack()}
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
              setTimes((current) => ({
                ...current,
                start,
              }))
            }
          />

          <TimeRow
            label="End"
            value={times.end}
            range={range}
            dateOptions={dateOptions}
            invalid={error !== null}
            onChange={(end) =>
              setTimes((current) => ({
                ...current,
                end,
              }))
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
          title={
            saving
              ? 'Saving...'
              : isEditing
                ? 'Save Changes'
                : 'Confirm Time'
          }
          onPress={() => void handleConfirmTime()}
          disabled={error !== null || saving}
        />
      </View>
    </LinearGradient>
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
    paddingBottom: 40,
    backgroundColor: 'transparent',
  },
});
