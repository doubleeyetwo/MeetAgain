import { useCallback, useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';
import { useAuth } from '@/features/auth/AuthContext';
import { AppStackParamList, ProfileStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import { UserProfile } from '@/types/models';
import { findUserByUsername } from '@/features/friends/friendships';
import { useFriendCount } from '@/features/friends/useFriendCount';

type ProfileNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList>,
  NativeStackNavigationProp<AppStackParamList>
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

function MemoriesGrid({ memories }: { memories: Memory[] }) {
  if (memories.length === 0) {
    return (
      <View style={styles.emptyMemories}>
        <Ionicons name="images-outline" size={32} color={colors.white} />
        <Text style={styles.emptyMemoriesText}>Events you attend will show up here.</Text>
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

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const { user } = useAuth();
  const friendCount = useFriendCount(user?.uid, user?.uid);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [usernameQuery, setUsernameQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchSequence = useRef(0);
  const pendingProfileUid = useRef<string | null>(null);
  const usernameInput = useRef<TextInputInstance>(null);

  // Queue navigation after the render that sets the search modal to hidden.
  useEffect(() => {
    if (usernameModalVisible || !pendingProfileUid.current) return;
    const uid = pendingProfileUid.current;
    pendingProfileUid.current = null;
    navigation.navigate('OtherProfile', { uid });
  }, [usernameModalVisible, navigation]);

  // Every dismissal shares one handler so it hides the native keyboard and clears the draft.
  const closeUsernameModal = useCallback(() => {
    // Ignore responses from searches started before this dismissal.
    ++searchSequence.current;
    Keyboard.dismiss();
    setUsernameQuery('');
    // Clear lookup feedback as well as the text so reopening starts with a fresh overlay.
    setSearching(false);
    setSearchError('');
    setUsernameModalVisible(false);
  }, []);

  // Re-read on focus so edits made on Edit Profile are reflected when the user comes back.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;

      (async () => {
        try {
          const snapshot = await getDoc(doc(db, collections.users, user.uid));
          if (!active) return;
          setProfile(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile) : null);
        } catch {
          if (active) setError('Could not load your profile. Pull back and try again.');
        } finally {
          if (active) setLoading(false);
        }
      })();

      // Ignore a resolved read once the screen has moved on.
      return () => {
        active = false;
      };
    }, [user]),
  );

  const birthday = formatBirthday(profile?.dateOfBirth);

  const searchUsername = async () => {
    // Ignore repeated submits without invalidating the request already in progress.
    if (searching) return;

    // Remember which search this response belongs to.
    const sequence = ++searchSequence.current;

    setSearching(true);
    setSearchError('');

    try {
      // Resolve the exact username before choosing the destination UID.
      const result = await findUserByUsername(usernameQuery);
      // The overlay closed or another search started while we waited.
      if (sequence !== searchSequence.current) return;

      // If no user was found, set the inline error and return.
      if (!result) {
        setSearchError('Could not find user.');
        return;
      }

      // A successful exact match is the selected destination; close the overlay
      // before navigating so the transparent modal cannot cover the profile.
      pendingProfileUid.current = result.uid;
      closeUsernameModal();
    } catch {
      // The overlay closed or another search started while we waited.
      if (sequence !== searchSequence.current) return;
      // A failed lookup is different from a successful lookup with no match.
      setSearchError('Search failed. Please try again.');
    } finally {
      // This runs even when the try block returns early or throws.
      // An outdated request must not clear the loading state of a newer request.
      if (sequence === searchSequence.current) setSearching(false);
    }
  };

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <Modal
          animationType="fade"
          onRequestClose={closeUsernameModal}
          // Focus after presentation so the OS opens its real keyboard over this transparent modal.
          onShow={() => usernameInput.current?.focus()}
          transparent
          visible={usernameModalVisible}
        >
          <View style={styles.usernameModalRoot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close username entry"
              onPress={closeUsernameModal}
              style={styles.usernameModalBackdrop}
            />
            {/* The field sits above the keyboard, so the native keyboard can open without shifting it. */}
            <View style={styles.usernameInputPosition}>
              <TextInput
                ref={usernameInput}
                editable={!searching}
                accessibilityLabel="Enter username"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(value) => {
                  // Store the new text so the input reflects what the user typed.
                  setUsernameQuery(value);

                  // Previous feedback belongs to the old username.
                  // Clear searchError.
                  setSearchError('');
                }}
                onSubmitEditing={() => {
                  // Dismiss the keyboard when the user submits.
                  Keyboard.dismiss();

                  // Start the lookup; searchUsername handles its own errors.
                  void searchUsername();
                }}
                placeholder="Enter Username..."
                placeholderTextColor={colors.white}
                returnKeyType="search"
                style={styles.usernameInput}
                value={usernameQuery}
              />
              {/* Show feedback only when the search has an error message. */}
              {/* Display the current error below the input; hide it when empty. */}
              {searchError ? (
                <Text accessibilityRole="alert" style={{ color: colors.white }}>
                  {searchError}
                </Text>
              ) : null}
            </View>
          </View>
        </Modal>

        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add friends"
            hitSlop={12}
            onPress={() => setUsernameModalVisible(true)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="person-add-outline" size={24} color={colors.white} />
          </Pressable>

          <View style={styles.headerRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              hitSlop={12}
              onPress={() => navigation.navigate('EditProfile')}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="create-outline" size={24} color={colors.white} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={12}
              onPress={() => navigation.navigate('Settings')}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="settings-outline" size={24} color={colors.white} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} style={styles.loader} />
          ) : (
            <>
              <View style={styles.avatarWrap}>
                {profile?.photoDataUrl || profile?.photoURL ? (
                  <Image
                    source={{ uri: profile.photoDataUrl ?? profile.photoURL }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons name="person" size={44} color={colors.white} />
                  </View>
                )}
              </View>

              <Text style={styles.name}>{profile?.displayName ?? ''}</Text>
              {profile?.username ? <Text style={styles.username}>@{profile.username}</Text> : null}

              <View style={styles.stats}>
                {/* Posts will be connected when the memories query is implemented. */}
                <Text style={styles.statText}>0 posts</Text>
                <Text style={styles.statDot}>·</Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="View friends list"
                  hitSlop={8}
                  // Keep the friends list in this tab so its bottom navigation stays visible.
                  onPress={() => navigation.navigate('Friends')}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.statText} accessibilityLiveRegion="polite">{friendCount.label}</Text>
                </Pressable>
                {friendCount.error ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Retry friend count" onPress={friendCount.retry} hitSlop={8}>
                    <Ionicons name="refresh" size={16} color={colors.white} />
                  </Pressable>
                ) : null}
              </View>

              {birthday ? <Text style={styles.birthday}>{birthday}</Text> : null}
              {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              ) : null}

              <MemoriesGrid memories={[]} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      {usernameModalVisible ? (
        // Keep blur in the profile view hierarchy so it samples the content beneath the transparent modal.
        <BlurView
          intensity={5}
          pointerEvents="none"
          style={styles.profileBlur}
          tint="default"
        />
      ) : null}
    </LinearGradient>
  );
}

export default ProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  profileBlur: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerRight: { flexDirection: 'row', gap: spacing.md },
  usernameModalRoot: { flex: 1 },
  usernameModalBackdrop: {
    // Dim the profile gently while leaving the username field crisp and easy to read.
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  usernameInputPosition: {
    position: 'absolute',
    top: '37%',
    alignSelf: 'center',
    width: '75%',
    maxWidth: 276,
  },
  usernameInput: {
    ...text.body,
    height: 50,
    paddingHorizontal: spacing.md,
    borderRadius: 17,
    backgroundColor: '#44356f',
    color: colors.white,
    textAlign: 'center',
  },
  content: {
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  loader: { marginTop: spacing.xxl },
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
  error: { ...text.body, color: '#ff9aa8', textAlign: 'center', marginTop: spacing.md },
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
});
