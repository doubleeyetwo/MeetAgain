import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import { MessagesStackParamList } from '@/navigation/types';
import { useAcceptedMessageFriends, MessageFriend } from '@/features/messages/useAcceptedMessageFriends';
import { useAuth } from '@/features/auth/AuthContext';
import { Group, watchGroups } from '@/features/messages/groups';

type Navigation = NativeStackNavigationProp<MessagesStackParamList, 'MessageList'>;
type Entry = { type: 'group'; value: Group } | { type: 'friend'; value: MessageFriend };

function nameOf(friend: MessageFriend) { return friend.profile?.displayName || friend.username; }

export function MessageFeedScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const { friends, loading: friendsLoading, error: friendsError, retry: retryFriends, uid: friendsUid } = useAcceptedMessageFriends();
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState(false);
  const [groupsRetry, setGroupsRetry] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    if (!user) {
      setGroups([]);
      setGroupsLoading(false);
      setGroupsError(false);
      return;
    }
    setGroups([]);
    setGroupsLoading(true);
    setGroupsError(false);
    const unsubscribe = watchGroups(user.uid, (items) => {
      if (!active) return;
      setGroups(items);
      setGroupsLoading(false);
      setGroupsError(false);
    }, () => {
      if (!active) return;
      setGroupsLoading(false);
      setGroupsError(true);
    });
    return () => { active = false; unsubscribe(); };
  }, [user?.uid, groupsRetry]);

  const entries = useMemo<Entry[]>(() => {
    if (!user || friendsUid !== user.uid) return [];
    const term = query.trim().toLocaleLowerCase();
    const matchingGroups = groups.filter((group) => !term || group.name.toLocaleLowerCase().includes(term));
    const matchingFriends = friends.filter((friend) => !term || `${nameOf(friend)} ${friend.profile?.username || friend.username}`.toLocaleLowerCase().includes(term));
    return [...matchingGroups.map((value) => ({ type: 'group' as const, value })), ...matchingFriends.map((value) => ({ type: 'friend' as const, value }))];
  }, [friends, friendsUid, groups, query, user]);

  const opening = (entry: Entry) => {
    if (entry.type === 'group') {
      navigation.navigate('Conversation', { kind: 'group', title: entry.value.name, memberIds: entry.value.memberIds, groupId: entry.value.id });
    } else {
      navigation.navigate('Conversation', { kind: 'friend', title: nameOf(entry.value), memberIds: [user!.uid, entry.value.uid] });
    }
  };
  const loading = groupsLoading || friendsLoading || (!!user && friendsUid !== user.uid);

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.topRow}>
          <View style={styles.searchField}>
            <Ionicons name="search" size={18} color={colors.white} />
            <TextInput accessibilityLabel="Search messages and friends" autoCapitalize="none" autoCorrect={false} onChangeText={setQuery}
              placeholder="Search..." placeholderTextColor="rgba(244, 241, 247, 0.62)" returnKeyType="search" style={styles.searchInput} value={query} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Add members to a new group" hitSlop={10} onPress={() => navigation.navigate('AddMembers')} style={styles.addButton}>
            <Ionicons name="add" size={29} color={colors.white} />
          </Pressable>
        </View>

        {groupsError || friendsError ? (
          <View style={styles.errorBanner}>
            <Text accessibilityRole="alert" style={styles.errorText}>Could not load {groupsError && friendsError ? 'groups or friends' : groupsError ? 'groups' : 'friends'}.</Text>
            <Pressable accessibilityRole="button" onPress={() => { if (groupsError) setGroupsRetry((value) => value + 1); if (friendsError) retryFriends(); }} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : null}
        {loading ? (
          <View style={styles.state}><ActivityIndicator color={colors.white} /><Text style={styles.stateText}>Loading messages...</Text></View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.type === 'group' ? `group-${item.value.id}` : `friend-${item.value.uid}`}
            contentContainerStyle={entries.length ? styles.list : styles.emptyList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" accessibilityLabel={item.type === 'group' ? `Open ${item.value.name}` : `Open conversation with ${nameOf(item.value)}`}
                onPress={() => opening(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                {item.type === 'group' ? (
                  <View style={[styles.avatar, styles.groupAvatar]}><Ionicons name="people" size={23} color={colors.white} /></View>
                ) : <FriendAvatar friend={item.value} />}
                <Text numberOfLines={1} style={styles.name}>{item.type === 'group' ? item.value.name : nameOf(item.value)}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.white} />
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.stateText}>{groupsError || friendsError ? 'Some messages could not be loaded. Try again.' : query.trim() ? 'No messages or friends match your search.' : 'Your friends and groups will appear here.'}</Text>}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function FriendAvatar({ friend }: { friend: MessageFriend }) {
  const uri = friend.profile?.photoDataUrl || friend.profile?.photoURL;
  return uri ? <Image source={{ uri }} style={styles.avatar} /> : (
    <View style={[styles.avatar, styles.friendAvatar]}><Text style={styles.avatarInitial}>{nameOf(friend).trim().charAt(0).toLocaleUpperCase() || '?'}</Text></View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginTop: spacing.sm, gap: spacing.sm },
  searchField: { flex: 1, height: 48, paddingHorizontal: spacing.md, borderRadius: 24, backgroundColor: colors.cardDarker, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: { flex: 1, color: colors.white, fontSize: 16, paddingVertical: 0 },
  addButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryAccent },
  list: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  row: { minHeight: 79, marginHorizontal: spacing.md, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.cardLighter },
  friendAvatar: { alignItems: 'center', justifyContent: 'center' },
  groupAvatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryAccent },
  avatarInitial: { color: colors.white, fontFamily: 'Moderustic_600SemiBold', fontSize: 20 },
  name: { ...text.header, flex: 1, color: colors.white },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  stateText: { ...text.body, color: colors.white, textAlign: 'center', lineHeight: 21 },
  errorBanner: { marginHorizontal: spacing.md, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 10, backgroundColor: 'rgba(237,28,28,0.14)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { ...text.body, color: colors.white, flex: 1 },
  retryButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  retryText: { color: colors.linkAccent, fontFamily: 'Moderustic_600SemiBold' },
  pressed: { opacity: 0.72 },
});
