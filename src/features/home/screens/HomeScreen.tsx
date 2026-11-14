import { eventAlert } from '@/features/events/eventAlert';

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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { db } from '@/config/firebase';
import { useAuth } from '@/features/auth/AuthContext';
import {
  updateEventRSVP,
  type RSVPStatus,
} from '@/features/events/eventRsvpService';
import { colors, gradients, spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

import {
  MeetNowBar,
  placeholderMeetNowFriends,
} from '../components/MeetNowBar';

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
  rsvps?: Record<string, RSVPStatus>;
};

export function HomeScreen() {
  const { user } = useAuth();

  const navigation =
    useNavigation<
      NativeStackNavigationProp<AppStackParamList>
    >();

  const [upcomingEvents, setUpcomingEvents] =
    useState<UpcomingEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [pendingRSVPs, setPendingRSVPs] = useState<
    string[]
  >([]);

  useEffect(() => {
    if (!user?.uid) {
      setUpcomingEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    const eventsQuery = query(
      collection(db, 'events'),
      where(
        'participantIds',
        'array-contains',
        user.uid
      )
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      snapshot => {
        const now = Date.now();

        const events: UpcomingEvent[] =
          snapshot.docs
            .flatMap((document): UpcomingEvent[] => {
              const data =
                document.data() as SavedEvent;

              if (!data.startAt || !data.endAt) {
                return [];
              }

              const startAt = data.startAt.toDate();
              const endAt = data.endAt.toDate();

              if (startAt.getTime() <= now) {
                return [];
              }

              // Declined events remain in Firebase
              // but disappear from this user's Home.
              if (data.rsvps?.[user.uid] === 'no') {
                return [];
              }

              const confirmedCount =
                (data.participantIds ?? []).filter(
                  id => data.rsvps?.[id] === 'yes'
                ).length;

              return [
                {
                  id: document.id,
                  title:
                    data.title ?? 'Untitled Event',
                  category:
                    data.category ?? 'Other',
                  startAt,
                  endAt,
                  location:
                    data.location ?? '',
                  eventPhoto:
                    data.photoURL ?? null,
                  attendeeCount: confirmedCount,
                  rsvpStatus:
                    data.rsvps?.[user.uid] ?? null,
                },
              ];
            })
            .sort(
              (a, b) =>
                a.startAt.getTime() -
                b.startAt.getTime()
            );

        setUpcomingEvents(events);
        setLoading(false);
        setError(false);
      },
      snapshotError => {
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

  const handleRSVP = async (
    event: UpcomingEvent,
    status: RSVPStatus
  ) => {
    if (!user?.uid) return;

    if (pendingRSVPs.includes(event.id)) {
      return;
    }

    setPendingRSVPs(previous => [
      ...previous,
      event.id,
    ]);

    try {
      await updateEventRSVP(
        event.id,
        user.uid,
        status
      );
    } catch (error) {
      console.error('RSVP failed:', error);

      eventAlert(
        'Unable to Update RSVP',
        'Your response could not be saved. Please try again.'
      );
    } finally {
      setPendingRSVPs(previous =>
        previous.filter(id => id !== event.id)
      );
    }
  };

  return (
    <LinearGradient
      colors={gradients.background}
      style={styles.screen}
    >
      <SafeAreaView
        style={styles.screen}
        edges={['top', 'left', 'right']}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* MEETNOW - teammate feature */}
          <MeetNowBar
            friends={placeholderMeetNowFriends}
          />

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
              upcomingEvents.map(event => (
                <UpcomingEventCard
                  key={event.id}
                  event={event}
                  rsvpBusy={pendingRSVPs.includes(
                    event.id
                  )}
                  onPress={selectedEvent => {
                    navigation.navigate(
                      'EventDetails',
                      {
                        eventId: selectedEvent.id,
                      }
                    );
                  }}
                  onRSVP={selectedEvent =>
                    handleRSVP(
                      selectedEvent,
                      'yes'
                    )
                  }
                  onDecline={selectedEvent =>
                    handleRSVP(
                      selectedEvent,
                      'no'
                    )
                  }
                />
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
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
