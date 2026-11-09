
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { getEventBackground } from '../eventBackgrounds';

export type UpcomingEvent = {
  id: string;
  title: string;
  category: string;
  startAt: Date;
  endAt: Date;
  location: string;
  eventPhoto?: string | null;
  attendeeCount?: number;
};
import { useState } from 'react';
 

type Props = {
  event: UpcomingEvent;
  onPress?: (event: UpcomingEvent) => void;
  onRSVP?: (event: UpcomingEvent) => void;
  onDecline?: (event: UpcomingEvent) => void;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function UpcomingEventCard({
  event,
  onPress,
  onRSVP,
  onDecline,
}: Props) {
  const [isRSVPed, setIsRSVPed] = useState(false);

  const background = getEventBackground(
    event.category,
    event.id,
    event.eventPhoto
  );

  return (
    <Pressable
      style={styles.card}
      onPress={() => onPress?.(event)}
      accessibilityRole="button"
      accessibilityLabel={`View ${event.title}`}
    >
      <ImageBackground
        source={background}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.18)',
            'rgba(0,0,0,0.55)',
            'rgba(0,0,0,0.85)',
          ]}
          locations={[0, 0.4, 1]}
          style={styles.overlay}
        >
          <View style={styles.topRow}>
            <View style={styles.eventInfo}>
              <Text style={styles.title} numberOfLines={1}>
                {event.title}
              </Text>

              <Text style={styles.detail} numberOfLines={1}>
                {formatTime(event.startAt)} - {formatTime(event.endAt)}
              </Text>

              <Text style={styles.location} numberOfLines={1}>
                <Ionicons
                  name="location-outline"
                  size={12}
                  color={colors.white}
                />
                {' '}{event.location}
              </Text>

              <Text style={styles.date}>
                {formatDate(event.startAt)}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={22}
              color={colors.white}
            />
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.attendees}>
              <Ionicons
                name="people-outline"
                size={17}
                color={colors.white}
              />
              <Text style={styles.attendeeText}>
                {event.attendeeCount ?? 0}
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onDecline?.(event);
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Decline ${event.title}`}
                style={styles.actionButton}
              >
                <Ionicons
                  name="thumbs-down-outline"
                  size={21}
                  color={colors.white}
                />
              </Pressable>

              <Pressable
                onPress={(e) => {
                    e.stopPropagation();
                    setIsRSVPed((previous) => !previous);
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`RSVP to ${event.title}`}
                accessibilityState={{ selected: isRSVPed }}
                style={styles.actionButton}
                >
                <Ionicons
                    name={isRSVPed ? 'thumbs-up' : 'thumbs-up-outline'}
                    size={21}
                    color={colors.white}
                />
                </Pressable>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: 142,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.cardDarker,
    marginBottom: spacing.sm,
  },

  background: {
    width: '100%',
    height: '100%',
  },

  backgroundImage: {
    borderRadius: radius.md,
  },

  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  eventInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },

  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  detail: {
    color: colors.white,
    fontSize: 12,
    marginTop: 3,
  },

  location: {
    color: colors.white,
    fontSize: 12,
    marginTop: 3,
  },

  date: {
    color: colors.white,
    fontSize: 12,
    marginTop: 3,
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  attendees: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  attendeeText: {
    color: colors.white,
    fontSize: 12,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },

  actionButton: {
    padding: 3,
  },
});
