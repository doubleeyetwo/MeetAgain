import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';
import { useAuth } from '@/features/auth/AuthContext';
import { Friendship, watchFriendships } from '@/features/friends/friendships';
import { ProfileStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import { PublicProfile } from '@/types/models';

type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList>;
type FriendRow = { uid: string; username: string; friendship: Friendship };
type FriendSection = { title: string; data: FriendRow[] };

export function FriendsScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [relationships, setRelationships] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [retry, setRetry] = useState(0);
  const profileCache = useRef(new Map<string, PublicProfile | null>());
  const profileRequests = useRef(new Map<string, Promise<PublicProfile | null>>());
  const [dataUserId, setDataUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      profileCache.current.clear();
      profileRequests.current.clear();
      setRelationships([]);
      setProfiles({});
      setDataUserId(null);
      setLoading(false);
      return;
    }

    let active = true;
    // Friendship and profile state must never cross an account switch.
    profileCache.current.clear();
    profileRequests.current.clear();
    setRelationships([]);
    setProfiles({});
    setDataUserId(user.uid);
    setLoading(true);
    setLoadError(false);
    setProfileError(false);

    // Observe only friendships that include this account; profile details are read individually by UID.
    const unsubscribe = watchFriendships(user.uid, (items) => {
      if (!active) return;
      setRelationships(items);
      setLoading(false);
      setLoadError(false);

      const profileUids = [...new Set(items.flatMap((item) => item.memberIds).filter((uid) => uid !== user.uid))];
      const missingUids = profileUids.filter((uid) => !profileCache.current.has(uid) && !profileRequests.current.has(uid));
      for (const uid of missingUids) {
        // Reuse each pending read across rapid snapshot updates instead of issuing duplicate requests.
        const request = getDoc(doc(db, collections.publicProfiles, uid)).then((snapshot) => (
          snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PublicProfile) : null
        ));
        profileRequests.current.set(uid, request);
      }

      const pendingUids = profileUids.filter((uid) => !profileCache.current.has(uid));
      if (pendingUids.length === 0) return;

      // Cache successful and missing documents, while leaving failed reads eligible for retry.
      void Promise.all(pendingUids.map(async (uid) => {
        const request = profileRequests.current.get(uid);
        if (!request) return [uid, null, true] as const;
        try {
          return [uid, await request, false] as const;
        } catch {
          return [uid, null, true] as const;
        } finally {
          if (profileRequests.current.get(uid) === request) profileRequests.current.delete(uid);
        }
      })).then((entries) => {
        if (!active) return;
        for (const [uid, profile, failed] of entries) {
          if (failed) setProfileError(true);
          else profileCache.current.set(uid, profile);
        }
        setProfiles(Object.fromEntries(Array.from(profileCache.current.entries()).filter((entry): entry is [string, PublicProfile] => entry[1] !== null)));
      });
    }, () => {
      if (!active) return;
      setLoading(false);
      setLoadError(true);
    });

    return () => {
      // Ignore profile reads and friendship updates after auth changes or leaving this screen.
      active = false;
      unsubscribe();
    };
  }, [user, retry]);

  const sections = useMemo<FriendSection[]>(() => {
    if (!user) return [];
    const accepted: FriendRow[] = [];
    const incoming: FriendRow[] = [];
    const outgoing: FriendRow[] = [];
    for (const friendship of relationships) {
      const uid = friendship.requesterId === user.uid ? friendship.recipientId : friendship.requesterId;
      const username = friendship.requesterId === user.uid ? friendship.recipientUsername : friendship.requesterUsername;
      const row = { uid, username, friendship };
      if (friendship.status === 'accepted') accepted.push(row);
      else if (friendship.status === 'pending' && friendship.recipientId === user.uid) incoming.push(row);
      else if (friendship.status === 'pending' && friendship.requesterId === user.uid) outgoing.push(row);
    }

    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = (row: FriendRow) => {
      const profile = profiles[row.uid];
      return !normalizedQuery || `${profile?.displayName ?? row.username} ${profile?.username ?? row.username}`
        .toLocaleLowerCase().includes(normalizedQuery);
    };
    const filter = (data: FriendRow[]) => data.filter(matches);
    const result: FriendSection[] = [];
    const matchedFriends = filter(accepted);
    if (matchedFriends.length) result.push({ title: '', data: matchedFriends });
    const matchedIncoming = filter(incoming);
    if (matchedIncoming.length) result.push({ title: 'Requests to you', data: matchedIncoming });
    const matchedOutgoing = filter(outgoing);
    if (matchedOutgoing.length) result.push({ title: 'Sent requests', data: matchedOutgoing });
    return result;
  }, [profiles, query, relationships, user]);

  const visibleRelationships = dataUserId === user?.uid ? relationships : [];
  const hasRelationships = visibleRelationships.some((item) => item.status === 'accepted' || item.status === 'pending');
  const openProfile = useCallback((uid: string) => navigation.navigate('OtherProfile', { uid }), [navigation]);

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.searchBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to profile"
            hitSlop={12}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={25} color={colors.white} />
          </Pressable>
          <View style={styles.searchField}>
            <Ionicons name="search" size={18} color={colors.white} />
            <TextInput
              accessibilityLabel="Search friends and requests"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search..."
              placeholderTextColor="rgba(244, 241, 247, 0.62)"
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
          </View>
        </View>

        {loadError ? (
          <View style={styles.stateContainer}>
            <Text accessibilityRole="alert" style={styles.stateText}>Could not load friends. Try again.</Text>
            <Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : loading || (!!user && dataUserId !== user.uid) ? (
          <View style={styles.stateContainer}><ActivityIndicator color={colors.white} /><Text style={styles.stateText}>Loading friends...</Text></View>
        ) : (
          <SectionList
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            sections={dataUserId === user?.uid ? sections : []}
            keyExtractor={(item) => item.friendship.id}
            renderSectionHeader={({ section }) => section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
            renderItem={({ item }) => {
              const profile = profiles[item.uid];
              const displayName = profile?.displayName || item.username;
              const photoUri = profile?.photoDataUrl || profile?.photoURL;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${displayName}'s profile`}
                  onPress={() => openProfile(item.uid)}
                  style={({ pressed }) => [styles.friendRow, pressed && styles.pressed]}
                >
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Ionicons name="person" size={22} color={colors.white} />
                    </View>
                  )}
                  <Text numberOfLines={1} style={styles.friendName}>{displayName}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.white} />
                </Pressable>
              );
            }}
            ListHeaderComponent={profileError ? (
              <View style={styles.profileError}>
                <Text accessibilityRole="alert" style={styles.stateText}>Some profile details could not load.</Text>
                <Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            ListEmptyComponent={(
              <View style={styles.stateContainer}>
                <Text style={styles.stateText}>
                  {query.trim() ? 'No friends or requests match your search.' : hasRelationships ? 'No friends or requests found.' : 'Your friends will appear here.'}
                </Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  backButton: { width: 30, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchField: {
    flex: 1,
    height: 46,
    borderRadius: 24,
    backgroundColor: colors.cardDarker,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: { ...text.body, flex: 1, color: colors.white, paddingVertical: 0 },
  listContent: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  sectionTitle: { ...text.body, color: colors.white, opacity: 0.72, marginTop: spacing.md, marginBottom: spacing.xs },
  friendRow: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: colors.cardLighter, alignItems: 'center', justifyContent: 'center' },
  friendName: { ...text.body, flex: 1, color: colors.white, fontSize: 16 },
  stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  stateText: { ...text.body, color: colors.white, textAlign: 'center' },
  profileError: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  retryButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 18, backgroundColor: colors.cardLighter },
  retryText: { ...text.body, color: colors.white },
  pressed: { opacity: 0.75 },
});
