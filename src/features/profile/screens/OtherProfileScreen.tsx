import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/features/auth/AuthContext';
import { Friendship, removeFriendship, respondToFriendRequest, sendFriendRequest, watchFriendships } from '@/features/friends/friendships';
import { collections } from '@/data/firestorePaths';
import { ProfileStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import { PublicProfile } from '@/types/models';

type Props = NativeStackScreenProps<
  ProfileStackParamList,
  'OtherProfile'
>;

// Memory tiles are 104x93 at a 367pt frame width; keep the ratio and let the row divide the width.
const TILE_ASPECT = 104 / 93;
const TILE_RADIUS = 10;
const GRID_GAP = 10;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* Render the stored ISO date as the design's "July 24th, 2003". */
function formatBirthday(iso?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) return '';
  const year = match[1];
  const month = MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month) return '';
  const remainder = day % 100;
  const suffix =
    remainder >= 11 && remainder <= 13
      ? 'th'
      : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th';
  return `${month} ${day}${suffix}, ${year}`;
}

type Memory = { id: string; photoUrl: string };

function MemoriesGrid({ memories, emptyMessage }: { memories: Memory[]; emptyMessage: string }) {
  if (memories.length === 0) {
    return (
      <View style={styles.emptyMemories}>
        <Ionicons name="images-outline" size={32} color={colors.white} />
        <Text style={styles.emptyMemoriesText}>{emptyMessage}</Text>
      </View>
    );
  }

  // Pad the final row so three tiles per row keep their width.
  const rows: (Memory | null)[][] = [];
  for (let index = 0; index < memories.length; index += 3) {
    const row: (Memory | null)[] = memories.slice(index, index + 3);
    while (row.length < 3) row.push(null);
    rows.push(row);
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          {row.map((memory, cellIndex) =>
            memory ? (
              <Image key={memory.id} source={{ uri: memory.photoUrl }} style={styles.tile} />
            ) : (
              <View key={`empty-${cellIndex}`} style={styles.tileSpacer} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

export function OtherProfileScreen({ navigation, route }: Props) {
  const { uid } = route.params;
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendshipsLoading, setFriendshipsLoading] = useState(true);
  const [friendshipsError, setFriendshipsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  // The ref closes the same-tick double-tap window before React can render disabled buttons.
  const requestLock = useRef(false);
  const confirmationOpen = useRef(false);
  const loadSequence = useRef(0);
  const actionSequence = useRef(0);
  const mounted = useRef(false);
  // Keep the current identities available to dialog callbacks immediately on
  // render, before the effects that reset action state have had time to run.
  const currentIdentity = useRef({ profileUid: uid, actingUid: user?.uid });
  currentIdentity.current = { profileUid: uid, actingUid: user?.uid };

  // Read only the public document. Sequence numbers prevent an older UID's
  // response (or a response after unmount) from replacing the current profile.
  const loadProfile = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError('');
    setProfile(null);
    try {
      const snapshot = await getDoc(doc(db, collections.publicProfiles, uid));
      if (sequence !== loadSequence.current) return;
      setProfile(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PublicProfile) : null);
      if (!snapshot.exists()) setError('This profile is unavailable.');
    } catch {
      if (sequence === loadSequence.current) setError('Could not load this profile. Please try again.');
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void loadProfile();
    return () => { ++loadSequence.current; };
  }, [loadProfile]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++actionSequence.current; };
  }, []);

  // A request may finish after the person or signed-in account changes. Invalidate
  // its UI updates whenever either identity changes, even if the screen stays mounted.
  useEffect(() => {
    ++actionSequence.current;
    requestLock.current = false;
    confirmationOpen.current = false;
    setBusy(false);
    setError('');
  }, [uid, user?.uid]);

  useEffect(() => {
    let active = true;
    setFriendships([]);
    setFriendshipsLoading(!!user);
    setFriendshipsError(false);
    if (!user) return () => { active = false; };
    const unsubscribe = watchFriendships(user.uid, (items) => {
      if (!active) return;
      setFriendships(items);
      setFriendshipsLoading(false);
      setFriendshipsError(false);
    }, () => {
      if (!active) return;
      setFriendshipsLoading(false);
      setFriendshipsError(true);
    });
    return () => { active = false; unsubscribe(); };
  }, [user, subscriptionAttempt]);

  const relationship = friendships.find((item) => item.memberIds.includes(uid));
  const isSelf = user?.uid === uid;
  const canSend = !!user && !isSelf && !friendshipsLoading && !friendshipsError &&
    (!relationship || (relationship.status === 'declined' && relationship.requesterId === user?.uid));
  const act = async (action: () => Promise<void>) => {
    if (requestLock.current) return;
    requestLock.current = true;
    const sequence = actionSequence.current;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      if (mounted.current && sequence === actionSequence.current) {
        setError(cause instanceof Error ? cause.message : 'Could not update friendship. Please try again.');
      }
    } finally {
      // An old action must not unlock a newer action for a different profile.
      if (mounted.current && sequence === actionSequence.current) {
        requestLock.current = false;
        setBusy(false);
      }
    }
  };

  const respond = (friendship: Friendship, response: 'accepted' | 'declined') => {
    if (!user || friendship.recipientId !== user.uid || friendship.status !== 'pending') return;
    void act(() => respondToFriendRequest(friendship, user.uid, response));
  };

  const sendRequest = () => {
    if (!user || !profile || !canSend) return;
    const recipient = { uid, username: profile.username, displayName: profile.displayName };
    void act(() => sendFriendRequest(user.uid, recipient));
  };
  const birthday = formatBirthday(profile?.dateOfBirth);

  const confirmUnfriend = () => {
    if (!user || busy || requestLock.current || confirmationOpen.current || relationship?.status !== 'accepted') return;
    confirmationOpen.current = true;
    const friendship = relationship;
    const actingUid = user.uid;
    const sequence = actionSequence.current;
    const message = `Remove ${profile?.displayName || 'this person'} from your friends?`;
    const removeConfirmedFriend = () => {
      // Confirmation may remain open while navigating or changing accounts.
      // Only start the action if this is still the same mounted profile.
      if (!mounted.current || sequence !== actionSequence.current ||
        currentIdentity.current.profileUid !== uid || currentIdentity.current.actingUid !== actingUid) return;
      confirmationOpen.current = false;
      void act(() => removeFriendship(friendship, actingUid));
    };
    // React Native Web's Alert does not show a dialog. The browser's confirmation
    // supplies the same cancel-or-remove choice when this screen runs on web.
    if (Platform.OS === 'web') {
      const confirmed = globalThis.confirm(message);
      if (sequence === actionSequence.current) confirmationOpen.current = false;
      if (confirmed) removeConfirmedFriend();
      return;
    }
    Alert.alert('Unfriend?', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => {
        if (sequence === actionSequence.current) confirmationOpen.current = false;
      } },
      {
        text: 'Unfriend',
        style: 'destructive',
        onPress: removeConfirmedFriend,
      },
    ], { cancelable: false });
  };

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            hitSlop={12}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarWrap}>
            {profile?.photoDataUrl || profile?.photoURL ? (
              <Image
                source={{ uri: profile.photoDataUrl || profile.photoURL }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={44} color={colors.white} />
              </View>
            )}
          </View>

          {loading ? <ActivityIndicator color={colors.white} /> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {!loading && !profile ? (
            <Pressable accessibilityRole="button" onPress={() => void loadProfile()} style={styles.action}>
              <Text style={styles.actionText}>Try again</Text>
            </Pressable>
          ) : null}
          {profile ? <>
            <Text style={styles.name}>{profile.displayName}</Text>
            {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}

            <View style={styles.stats}>
              {/* These totals have no public data source yet, so retain the existing placeholders. */}
              <Text style={styles.statText}>0 posts</Text>
              <Text style={styles.statDot}>·</Text>
              <Text style={styles.statText}>0 Friends</Text>
            </View>

            {birthday ? <Text style={styles.birthday}>{birthday}</Text> : null}
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            {!isSelf ? (
              <View style={styles.friendActions}>
                {friendshipsLoading ? <ActivityIndicator color={colors.white} /> : friendshipsError ? (
                  <View style={styles.friendActions}>
                    <Text style={styles.error}>Could not load friendship status.</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Retry loading friendship status"
                      accessibilityState={{ disabled: false }}
                      onPress={() => setSubscriptionAttempt((attempt) => attempt + 1)}
                      style={styles.action}
                    ><Text style={styles.actionText}>Retry</Text></Pressable>
                  </View>
                ) : relationship?.status === 'accepted' ? (
                  <View style={styles.friendActions}>
                    <Text style={styles.actionText}>Friends</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Unfriend"
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={confirmUnfriend}
                      style={({ pressed }) => [styles.action, (pressed || busy) && styles.pressed]}
                    ><Text style={styles.actionText}>{busy ? 'Removing…' : 'Unfriend'}</Text></Pressable>
                  </View>
                ) : relationship?.status === 'pending' && relationship.requesterId === user?.uid ? (
                  <Text style={styles.actionText}>Request sent</Text>
                ) : relationship?.status === 'pending' ? (
                  <View style={styles.friendActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Accept friend request"
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => respond(relationship, 'accepted')}
                      style={styles.action}
                    ><Text style={styles.actionText}>{busy ? 'Please wait…' : 'Accept request'}</Text></Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Decline friend request"
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => respond(relationship, 'declined')}
                      style={styles.action}
                    ><Text style={styles.actionText}>Decline</Text></Pressable>
                  </View>
                ) : canSend ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add friend"
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={sendRequest}
                    style={({ pressed }) => [styles.gradientButton, (pressed || busy) && styles.pressed]}
                  >
                    <LinearGradient colors={gradients.purpleAccent} {...gradientDirection.horizontal} style={styles.actionGradient}>
                      <Text style={styles.actionText}>{busy ? 'Sending…' : relationship?.status === 'declined' ? 'Send request again' : 'Add Friend'}</Text>
                    </LinearGradient>
                  </Pressable>
                ) : relationship?.status === 'declined' ? (
                  <Text style={styles.actionText}>Request declined</Text>
                ) : null}
              </View>
            ) : null}

            <MemoriesGrid memories={[]} emptyMessage="Their events will show up here." />
          </> : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default OtherProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  content: {
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  avatarWrap: { marginTop: spacing.sm },
  avatar: { width: 99, height: 99, borderRadius: 50 },
  avatarFallback: {
    backgroundColor: colors.cardDarker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...text.body,
    fontSize: 20,
    letterSpacing: 0.2,
    color: colors.white,
    marginTop: spacing.md,
  },
  username: { ...text.body, color: colors.white, opacity: 0.7, marginTop: 2 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statText: { ...text.body, color: colors.white },
  statDot: { ...text.body, color: colors.white },
  birthday: { ...text.body, color: colors.white, marginTop: spacing.xs },
  bio: {
    ...text.body,
    color: colors.white,
    textAlign: 'center',
    width: 228,
    marginTop: spacing.lg,
  },
  grid: {
    width: '100%',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: GRID_GAP,
  },
  gridRow: { flexDirection: 'row', gap: GRID_GAP },
  tile: { flex: 1, aspectRatio: TILE_ASPECT, borderRadius: TILE_RADIUS },
  tileSpacer: { flex: 1 },
  emptyMemories: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyMemoriesText: { ...text.body, color: colors.white, opacity: 0.6, textAlign: 'center' },
  pressed: { opacity: 0.85 },
  error: { ...text.body, color: '#ff9aa8', textAlign: 'center', marginTop: spacing.md },
  friendActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  action: { backgroundColor: colors.cardDarker, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 12 },
  gradientButton: { borderRadius: 12, overflow: 'hidden' },
  actionGradient: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 12 },
  actionText: { ...text.body, color: colors.white },
});
