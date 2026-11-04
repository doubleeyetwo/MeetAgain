
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection,
  onSnapshot,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';

import { db } from '@/config/firebase';
import { useAuth } from '@/features/auth/AuthContext';
import { colors, gradients, spacing } from '@/theme';
import {
  UpcomingEventCard,
  type UpcomingEvent,
} from '../components/UpcomingEventCard';

type SavedEvent = {
  title?: string;
  category?: string;
  startAt?: Timestamp;
  endAt?: Timestamp;
  location?: string;
  photoURL?: string | null;
  participantIds?: string[];
};

export function HomeScreen() {
  const { user } = useAuth();

  const [upcomingEvents, setUpcomingEvents] = useState<
    UpcomingEvent[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setUpcomingEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    // Find events where the signed-in user is a participant.
    const eventsQuery = query(
      collection(db, 'events'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const now = Date.now();

        const events: UpcomingEvent[] = snapshot.docs
          .flatMap((document): UpcomingEvent[] => {
            const data = document.data() as SavedEvent;

            if (!data.startAt || !data.endAt) {
              return [];
            }

            const startAt = data.startAt.toDate();
            const endAt = data.endAt.toDate();

            if (startAt.getTime() <= now) {
              return [];
            }

            return [
              {
                id: document.id,
                title: data.title ?? 'Untitled Event',
                category: data.category ?? 'Other',
                startAt,
                endAt,
                location: data.location ?? '',
                eventPhoto: data.photoURL ?? null,
                attendeeCount: 0,
              },
            ];
          })
          .sort(
            (a, b) =>
              a.startAt.getTime() - b.startAt.getTime()
  );

        setUpcomingEvents(events);
        setLoading(false);
        setError(false);
      },
      (snapshotError) => {
        console.error(
          'Could not load upcoming events:',
          snapshotError
        );
        setUpcomingEvents([]);
        setLoading(false);
        setError(true);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  return (
    <LinearGradient
      colors={gradients.background}
      style={styles.screen}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* MEETNOW - Reserved for teammate */}
        <View style={styles.meetNowSpace} />

        {/* UPCOMING EVENTS */}
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>
            Upcoming
          </Text>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator
                size="large"
                color={colors.primaryAccent}
              />
              <Text style={styles.stateDescription}>
                Loading upcoming events...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <Ionicons
                name="alert-circle-outline"
                size={40}
                color={colors.linkAccent}
              />
              <Text style={styles.stateTitle}>
                Unable to Load Events
              </Text>
              <Text style={styles.stateDescription}>
                Please check your connection and try again.
              </Text>
            </View>
          ) : upcomingEvents.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons
                name="calendar-outline"
                size={42}
                color={colors.linkAccent}
              />
              <Text style={styles.stateTitle}>
                No Upcoming Events
              </Text>
              <Text style={styles.stateDescription}>
                Events you're invited to will appear here.
              </Text>
            </View>
          ) : (
            upcomingEvents.map((event) => (
              <UpcomingEventCard
                key={event.id}
                event={event}
              />
            ))
          )}
        </View>
      </ScrollView>
    </LinearGradient>
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
    paddingBottom: spacing.xxl,
  },

  meetNowSpace: {
    height: 170,
  },

  upcomingSection: {
    paddingHorizontal: spacing.md,
  },

  sectionTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 55,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },

  stateTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.sm,
  },

  stateDescription: {
    color: colors.linkAccent,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
