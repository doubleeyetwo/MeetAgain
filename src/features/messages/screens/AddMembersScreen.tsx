import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import { MessagesStackParamList } from '@/navigation/types';
import { useAcceptedMessageFriends } from '@/features/messages/useAcceptedMessageFriends';
import { useAuth } from '@/features/auth/AuthContext';
import { createGroup, MAX_GROUP_MEMBERS } from '@/features/messages/groups';
import { FriendAvatar, friendDisplayName, friendSearchText } from '@/features/messages/FriendDisplay';

type Navigation = NativeStackNavigationProp<MessagesStackParamList, 'AddMembers'>;
const MAX_SELECTED = MAX_GROUP_MEMBERS - 1;

export function AddMembersScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const { friends, loading, error: friendsError, retry } = useAcceptedMessageFriends();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  const currentUid = useRef(user?.uid ?? null);
  useEffect(() => {
    currentUid.current = user?.uid ?? null;
    setSelected([]);
    setSaveError('');
  }, [user?.uid]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !saving });
  }, [navigation, saving]);
  useEffect(() => {
    if (loading) return;
    const available = new Set(friends.map((friend) => friend.uid));
    setSelected((current) => current.filter((uid) => available.has(uid)));
  }, [friends, loading]);
  const filteredFriends = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? friends.filter((friend) => friendSearchText(friend).toLocaleLowerCase().includes(term)) : friends;
  }, [friends, query]);

  const toggle = (uid: string) => {
    setSaveError('');
    setSelected((current) => current.includes(uid)
      ? current.filter((item) => item !== uid)
      : current.length < MAX_SELECTED ? [...current, uid] : current);
  };

  const confirm = async () => {
    const availableIds = new Set(friends.map((friend) => friend.uid));
    if (!user || busy.current || loading || friendsError || selected.length === 0 || selected.length > MAX_SELECTED
      || selected.some((uid) => !availableIds.has(uid))) return;
    busy.current = true;
    setSaving(true);
    setSaveError('');
    const creatorUid = user.uid;
    try {
      const group = await createGroup(creatorUid, selected);
      if (!mounted.current || currentUid.current !== creatorUid) return;
      navigation.replace('Conversation', {
        kind: 'group',
        title: group.name,
        memberIds: group.memberIds,
        groupId: group.id,
      });
    } catch (reason) {
      if (mounted.current && currentUid.current === creatorUid) setSaveError(reason instanceof Error ? reason.message : 'Could not create the group. Try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const confirmDisabled = selected.length === 0 || saving || loading || friendsError;
  const confirmLooksDisabled = selected.length === 0 || saving;

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" accessibilityState={{ disabled: saving }} disabled={saving} hitSlop={12} onPress={() => navigation.goBack()} style={styles.side}>
            <Ionicons name="chevron-back" size={25} color={colors.white} />
          </Pressable>
          <Text style={styles.title}>Add Members</Text>
          <View style={styles.side} />
        </View>
        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={colors.white} />
          <TextInput
            accessibilityLabel="Search accepted friends"
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
        <Text style={styles.selectionCount}>{selected.length} selected · up to {MAX_SELECTED} friends</Text>

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.white} />
            <Text style={styles.stateText}>Loading friends...</Text>
          </View>
        ) : friendsError ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.stateText}>Could not load friends. Try again.</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredFriends}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={filteredFriends.length ? styles.list : styles.emptyList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const checked = selected.includes(item.uid);
              const capped = !checked && selected.length >= MAX_SELECTED;
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, disabled: capped }}
                  accessibilityLabel={`${friendDisplayName(item)}, ${checked ? 'selected' : 'not selected'}`}
                  disabled={capped || saving}
                  onPress={() => toggle(item.uid)}
                  style={({ pressed }) => [styles.friendRow, pressed && styles.pressed, capped && styles.disabledRow]}
                >
                  <FriendAvatar friend={item} size={52} />
                  <View style={styles.friendInfo}>
                    <Text numberOfLines={1} style={styles.friendName}>{friendDisplayName(item)}</Text>
                    <Text numberOfLines={1} style={styles.username}>@{item.profile?.username || item.username}</Text>
                  </View>
                  <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
                    {checked ? <Ionicons name="checkmark" size={17} color={colors.white} /> : null}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={<EmptyFriendsMessage query={query} friendCount={friends.length} />}
            showsVerticalScrollIndicator={false}
          />
        )}

        {saveError ? <Text accessibilityRole="alert" style={styles.errorText}>{saveError}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: confirmDisabled, busy: saving }}
          disabled={confirmDisabled}
          onPress={() => void confirm()}
          style={({ pressed }) => [styles.confirmButton, confirmLooksDisabled && styles.confirmDisabled, pressed && styles.pressed]}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.confirmText}>Confirm Members</Text>
          )}
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

function EmptyFriendsMessage({ query, friendCount }: { query: string; friendCount: number }) {
  let message = 'Your accepted friends will appear here.';
  if (query.trim()) message = 'No friends match your search.';
  else if (friendCount > 0) message = 'No accepted friends found.';
  return <Text style={styles.stateText}>{message}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  side: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { ...text.title, flex: 1, color: colors.white, textAlign: 'center' },
  searchField: { height: 48, marginHorizontal: spacing.md, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 24, backgroundColor: colors.cardDarker, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: { flex: 1, color: colors.white, fontSize: 16, paddingVertical: 0 },
  selectionCount: { ...text.body, color: 'rgba(244,241,247,0.72)', marginHorizontal: spacing.lg, marginTop: spacing.md },
  list: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  friendRow: { minHeight: 76, marginHorizontal: spacing.md, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  friendInfo: { flex: 1 },
  friendName: { color: colors.white, fontFamily: 'Moderustic_600SemiBold', fontSize: 17 },
  username: { color: 'rgba(244,241,247,0.68)', marginTop: 2, fontSize: 13 },
  checkbox: { width: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(244,241,247,0.75)', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent },
  disabledRow: { opacity: 0.52 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  stateText: { ...text.body, color: colors.white, textAlign: 'center', lineHeight: 21 },
  retryButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryText: { color: colors.linkAccent, fontFamily: 'Moderustic_600SemiBold' },
  errorText: { color: '#ffb7b7', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, textAlign: 'center' },
  confirmButton: { minHeight: 54, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 28, backgroundColor: colors.primaryAccent, alignItems: 'center', justifyContent: 'center' },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: colors.white, fontFamily: 'Moderustic_600SemiBold', fontSize: 16 },
  pressed: { opacity: 0.75 },
});
