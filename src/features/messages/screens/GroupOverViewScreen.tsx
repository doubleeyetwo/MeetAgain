import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import type { AppStackParamList, MessagesStackParamList } from '@/navigation/types';
import { db } from '@/config/firebase';
import { useAuth } from '@/features/auth/AuthContext';
import type { Group } from '@/features/messages/groups';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, text } from '@/theme';
import { watchGroup } from '@/features/messages/groups';

type Props = NativeStackScreenProps<MessagesStackParamList, 'GroupOverview'>;

// watchGroup lives in the service module; this screen owns state and rendering.

export function GroupOverviewScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const uid = user?.uid;
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<{ id: string; title: string; startAt: Date }[] | null>(null);
  const [eventsError, setEventsError] = useState(false);

  useEffect(() => {
    setEvents(null);
    setEventsError(false);
    if (!uid) return;

    // Include the participant filter required by the Firestore event read rule.
    const groupEvents = query(
      collection(db, 'events'),
      where('groupId', '==', groupId),
      where('participantIds', 'array-contains', uid),
    );
    return onSnapshot(groupEvents, (snapshot) => {
      const now = Date.now();
      const upcoming = snapshot.docs.flatMap((event) => {
        const data = event.data();
        const startAt = data.startAt?.toDate?.();
        if (!startAt || !(data.endAt?.toMillis?.() > now) || data.status === 'cancelled') return [];
        return [{ id: event.id, title: data.title ?? 'Untitled Event', startAt }];
      });
      setEvents(upcoming.sort((a, b) => a.startAt.getTime() - b.startAt.getTime()));
      setEventsError(false);
    }, () => setEventsError(true));
  }, [groupId, uid]);

  useEffect(() => {
    // Clear the previous group's data before starting a new subscription.
    setGroup(null);
    setLoading(true);
    setError('');

    const unsubscribe = watchGroup(
      groupId,
      (nextGroup) => {
        setGroup(nextGroup);
        setError('');
        setLoading(false);
      },
      (subscriptionError) => {
        setGroup(null);
        setError(subscriptionError.message);
        setLoading(false);
      },
    );

    // React cleans up the old listener on unmount or when groupId changes.
    return () => unsubscribe();
  }, [groupId]);

  // The live subscription refreshes this photo after Settings saves it.
  const photoUri = group?.photoDataUrl;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="" onBack={() => navigation.goBack()} />
      {/* Keep the profile content scrollable while preserving the shared safe-area back header. */}
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.white} accessibilityLabel="Loading group" style={styles.loading} />
        ) : error !== '' || group === null ? (
          <View style={styles.unavailable}>
            <Text style={styles.body}>{error || 'This group is unavailable.'}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.popToTop()}
              style={styles.control}
            >
              <Text style={styles.body}>Back to messages</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.profile}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} accessibilityLabel="Group photo" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="people-outline" size={44} color={colors.white} />
              </View>
            )}
            <Text style={styles.title}>{group.name}</Text>

            <View style={styles.controls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View group members"
                style={styles.iconControl}
                onPress={() => navigation.navigate('GroupMembers', { groupId })}
              >
                <Ionicons name="people-outline" size={24} color={colors.white} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open group settings"
                style={styles.iconControl}
                onPress={() => navigation.navigate('GroupSettings', { groupId })}
              >
                <Ionicons name="settings-outline" size={24} color={colors.white} />
              </Pressable>
            </View>

            <View style={styles.events}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              {eventsError ? (
                <Text style={styles.emptyText}>Could not load upcoming events.</Text>
              ) : events === null ? (
                <ActivityIndicator color={colors.white} accessibilityLabel="Loading upcoming events" />
              ) : events.length === 0 ? (
                <Text style={styles.emptyText}>No upcoming events.</Text>
              ) : events.map((event) => (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  style={styles.control}
                  onPress={() => navigation.getParent<NativeStackNavigationProp<AppStackParamList>>()
                    ?.navigate('EventDetails', { eventId: event.id })}
                >
                  <Text style={styles.body}>{event.title}</Text>
                  <Text style={styles.emptyText}>{event.startAt.toLocaleString()}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 12, paddingBottom: 24 },
  loading: { marginTop: 24 },
  unavailable: { alignItems: 'center', paddingTop: 24 },
  body: { ...text.body, color: colors.white, textAlign: 'center' },
  profile: { alignItems: 'center', width: '100%' },
  title: { ...text.title, color: colors.white, textAlign: 'center', marginTop: 20 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.cardDarker,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  avatarFallback: { backgroundColor: colors.cardDarker },
  controls: { flexDirection: 'row', gap: 20, marginTop: 20 },
  iconControl: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  control: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginTop: 12, borderRadius: 12, backgroundColor: colors.cardDarker },
  events: { alignItems: 'center', width: '100%', marginTop: 28 },
  sectionTitle: { ...text.title, color: colors.white, textAlign: 'center' },
  emptyText: { ...text.body, color: colors.white, opacity: 0.65, textAlign: 'center', marginTop: 16 },
});
