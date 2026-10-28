import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text } from '@/theme';

type Props = {
  title: string;
  date: string;
  time: string;
  location?: string;
  photoURL?: string | null;
};

export function EventChatCard({
  title,
  date,
  time,
  location,
  photoURL,
}: Props) {
  return (
    <View style={styles.card}>
      {/* Event photo */}
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={styles.eventPhoto}
          resizeMode="cover"
        />
      ) : null}

      {/* Card heading */}
      <Text style={styles.heading}>Event Details</Text>

      {/* Event title */}
      <Text style={styles.eventTitle}>{title}</Text>

      <View style={styles.divider} />

      {/* Date */}
      <View style={styles.detail}>
        <Ionicons
          name="calendar-outline"
          size={17}
          color={colors.white}
        />
        <Text style={styles.detailText}>{date}</Text>
      </View>

      {/* Time */}
      <View style={styles.detail}>
        <Ionicons
          name="time-outline"
          size={17}
          color={colors.white}
        />
        <Text style={styles.detailText}>{time}</Text>
      </View>

      {/* Location */}
      <View style={styles.detail}>
        <Ionicons
          name="location-outline"
          size={17}
          color={colors.white}
        />
        <Text style={styles.detailText}>
          {location || 'Location not selected'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.cardDarker,
  },

  eventPhoto: {
    width: '100%',
    height: 140,
    borderRadius: 8,
  },

  heading: {
    ...text.header,
    color: colors.white,
    textAlign: 'center',
  },

  eventTitle: {
    ...text.body,
    color: colors.white,
    textAlign: 'center',
    fontWeight: '600',
  },

  divider: {
    height: 2,
    backgroundColor: colors.primaryAccent,
  },

  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },

  detailText: {
    ...text.body,
    color: colors.white,
    flex: 1,
  },
});