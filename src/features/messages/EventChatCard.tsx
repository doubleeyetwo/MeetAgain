import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

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
      {/* Event Photo */}
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={styles.eventPhoto}
          resizeMode="cover"
        />
      ) : null}

      {/* Event Label */}
      <View style={styles.heading}>
        <Ionicons
          name="calendar-outline"
          size={22}
          color={colors.white}
        />
        <Text style={styles.headingText}>EVENT</Text>
      </View>

      {/* Event Name */}
      <Text style={styles.title}>{title}</Text>

      {/* Event Date */}
      <View style={styles.detail}>
        <Ionicons
          name="calendar-outline"
          size={17}
          color={colors.white}
        />
        <Text style={styles.detailText}>{date}</Text>
      </View>

      {/* Event Time */}
      <View style={styles.detail}>
        <Ionicons
          name="time-outline"
          size={17}
          color={colors.white}
        />
        <Text style={styles.detailText}>{time}</Text>
      </View>

      {/* Event Location */}
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
    backgroundColor: colors.cardDarker,
    borderRadius: 16,
    padding: 18,
    marginVertical: 12,
    gap: 12,
  },

  eventPhoto: {
    width: '100%',
    height: 160,
    borderRadius: 12,
  },

  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headingText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },

  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },

  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  detailText: {
    color: colors.white,
    fontSize: 14,
    flex: 1,
  },
});