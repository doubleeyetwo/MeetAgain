
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '@/features/auth/AuthContext';
import {
  useAcceptedMessageFriends,
  type MessageFriend,
} from '@/features/messages/useAcceptedMessageFriends';
import {
  FriendAvatar,
  friendDisplayName,
  friendSearchText,
} from '@/features/messages/FriendDisplay';
import {
  watchGroups,
  MAX_GROUP_MEMBERS,
  type Group,
} from '@/features/messages/groups';
import {
  colors,
  gradients,
  gradientDirection,
  spacing,
  fontFamily,
} from '@/theme';
import type { EventCreationStackParamList } from '@/features/events/navigation/EventCreationNavigator';

type Props = NativeStackScreenProps<
  EventCreationStackParamList,
  'SelectMembers'
>;

type Entry =
  | { type: 'group'; value: Group }
  | { type: 'friend'; value: MessageFriend };

const MAX_SELECTED = MAX_GROUP_MEMBERS - 1;

export function SelectMembersScreen({
  navigation,
  route,
}: Props) {
  const { user } = useAuth();

  const {
    friends,
    loading: friendsLoading,
    error: friendsError,
    retry: retryFriends,
    uid: friendsUid,
  } = useAcceptedMessageFriends();

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState(false);
  const [groupsRetry, setGroupsRetry] = useState(0);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Load the user's existing group chats.
  // This reuses the same function as the Messages screen.
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

    const unsubscribe = watchGroups(
      user.uid,
      (items) => {
        if (!active) return;

        setGroups(items);
        setGroupsLoading(false);
        setGroupsError(false);
      },
      () => {
        if (!active) return;

        setGroupsLoading(false);
        setGroupsError(true);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.uid, groupsRetry]);

  // Clear selections if the signed-in account changes.
  useEffect(() => {
    setSelected([]);
  }, [user?.uid]);

  const friendIds = useMemo(
    () => new Set(friends.map((friend) => friend.uid)),
    [friends]
  );

  // Display group chats first, then friends.
  // No separate headings, matching the Figma layout.
  const entries = useMemo<Entry[]>(() => {
    if (!user || friendsUid !== user.uid) {
      return [];
    }

    const search = query.trim().toLowerCase();

    const matchingGroups = groups
      .filter((group) => !group.deleting &&
        group.name.toLowerCase().includes(search))
      .map((value) => ({
        type: 'group' as const,
        value,
      }));

    const matchingFriends = friends
      .filter((friend) =>
        friendSearchText(friend)
          .toLowerCase()
          .includes(search)
      )
      .map((value) => ({
        type: 'friend' as const,
        value,
      }));

    return [...matchingGroups, ...matchingFriends];
  }, [groups, friends, friendsUid, query, user]);

  // Select or deselect one friend.
  const toggleFriend = (uid: string) => {
    setSelectedGroupId(null);
    setSelected((current) => {
      if (current.includes(uid)) {
        return current.filter((id) => id !== uid);
      }

      if (current.length >= MAX_SELECTED) {
        return current;
      }

      return [...current, uid];
    });
  };

  // Selecting a group replaces the current selection
  // with that group's members.
  //
  const toggleGroup = (group: Group) => {
    if (!user) return;
    if (group.deleting) return;

    const members = group.memberIds.filter(
      (uid) => uid !== user.uid
    );

    if (
      members.length === 0 ||
      members.length > MAX_SELECTED
    ) {
      Alert.alert(
        'Cannot Select Group',
        'This group cannot be selected for the event.'
      );
      return;
    }

    const alreadySelected =
      selected.length === members.length &&
      members.every((uid) => selected.includes(uid));

    if (alreadySelected && selectedGroupId === group.id) {
      setSelected([]);
      setSelectedGroupId(null);
    } else {
      setSelected(members);
      setSelectedGroupId(group.id);
    }
  };

  // Check only the group explicitly selected by the user.
  const isGroupSelected = (group: Group) => {
    if (!user || selectedGroupId !== group.id) return false;

    const members = group.memberIds.filter(
      (uid) => uid !== user.uid
    );

    return (
      members.length > 0 &&
      members.length === selected.length &&
      members.every((uid) => selected.includes(uid))
    );
  };

  const loading =
    groupsLoading ||
    friendsLoading ||
    (!!user && friendsUid !== user.uid);

  const hasError = groupsError || friendsError;

  const retry = () => {
    if (groupsError) {
      setGroupsRetry((value) => value + 1);
    }

    if (friendsError) {
      retryFriends();
    }
  };

  const confirm = () => {
    if (!user || loading || hasError) {
      return;
    }

    if (selected.length === 0) {
      Alert.alert(
        'Select People',
        'Choose at least one person or group.'
      );
      return;
    }

    const selectedIds = [user.uid, ...selected].sort();
    const sameMembers = (group: Group) => {
      const memberIds = [...group.memberIds].sort();
      return memberIds.length === selectedIds.length &&
        memberIds.every((uid, index) => uid === selectedIds[index]);
    };
    const explicitlySelectedGroup = selectedGroupId
      ? groups.find((group) => !group.deleting && group.id === selectedGroupId && sameMembers(group))
      : undefined;
    const matchingGroup = explicitlySelectedGroup ?? groups.find((group) => !group.deleting && sameMembers(group));

    // Only a new group requires every selected person to remain an accepted friend.
    if (!matchingGroup && selected.some((uid) => !friendIds.has(uid))) {
      Alert.alert(
        'Cannot Create Group',
        'Everyone in a new event group must be an accepted friend.'
      );
      return;
    }

    navigation.navigate('ReviewEvent', {
      ...route.params,
      selectedMemberIds: selectedIds,
      matchingGroupId: matchingGroup?.id,
    });
  };

  const renderEntry = ({ item }: { item: Entry }) => {
    const isGroup = item.type === 'group';

    const name = isGroup
      ? item.value.name
      : friendDisplayName(item.value);

    const checked = isGroup
      ? isGroupSelected(item.value)
      : selected.includes(item.value.uid);

    const disabled =
      !isGroup &&
      !checked &&
      selected.length >= MAX_SELECTED;

    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={name}
        accessibilityState={{
          checked,
          disabled,
        }}
        disabled={disabled}
        onPress={() => {
          if (item.type === 'group') {
            toggleGroup(item.value);
          } else {
            toggleFriend(item.value.uid);
          }
        }}
        style={({ pressed }) => [
          styles.personRow,
          pressed && styles.pressed,
          disabled && styles.disabledRow,
        ]}
      >
        {item.type === 'group' ? (
          <View style={styles.groupAvatar}>
            <Ionicons
              name="people"
              size={26}
              color={colors.white}
            />
          </View>
        ) : (
          <FriendAvatar
            friend={item.value}
            size={54}
          />
        )}

        <Text
          numberOfLines={1}
          style={styles.personName}
        >
          {name}
        </Text>

        <View
          style={[
            styles.selectionCircle,
            checked && styles.selectedCircle,
          ]}
        >
          {checked && (
            <Ionicons
              name="checkmark"
              size={18}
              color={colors.white}
            />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <LinearGradient
      colors={gradients.background}
      {...gradientDirection.vertical}
      style={styles.screen}
    >
      {/* Top bar — no extra SafeAreaView or top padding */}
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons
            name="chevron-back"
            size={27}
            color={colors.white}
          />
        </Pressable>

        <View style={styles.searchField}>
          <Ionicons
            name="search"
            size={22}
            color={colors.white}
          />

          <TextInput
            accessibilityLabel="Search groups and friends"
            value={query}
            onChangeText={setQuery}
            placeholder="Search..."
            placeholderTextColor="rgba(244,241,247,0.65)"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* Loading and errors */}
      {hasError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            Could not load groups or friends.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={retry}
          >
            <Text style={styles.retryText}>
              Retry
            </Text>
          </Pressable>
        </View>
      )}

      {/* One continuous list: groups, then friends */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.white} />

          <Text style={styles.loadingText}>
            Loading people...
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.listContainer}
          data={entries}
          keyExtractor={(item) =>
            item.type === 'group'
              ? `group-${item.value.id}`
              : `friend-${item.value.uid}`
          }
          renderItem={renderEntry}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            entries.length > 0
              ? styles.listContent
              : styles.emptyList
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query.trim()
                ? 'No groups or friends match your search.'
                : 'Your groups and friends will appear here.'}
            </Text>
          }
        />
      )}

      {/* Fixed bottom confirmation button */}
      <View style={styles.bottomContainer}>
        <LinearGradient
          colors={gradients.purpleAccent}
          {...gradientDirection.horizontal}
          style={styles.confirmGradient}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm People"
            accessibilityState={{
              disabled:
                loading ||
                hasError ||
                selected.length === 0,
            }}
            disabled={
              loading ||
              hasError ||
              selected.length === 0
            }
            onPress={confirm}
            style={({ pressed }) => [
              styles.confirmButton,
              (loading ||
                hasError ||
                selected.length === 0) &&
                styles.confirmDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.confirmText}>
              Confirm People
            </Text>
          </Pressable>
        </LinearGradient>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

topRow: {
  height: 76,
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: spacing.md,
  paddingTop: 90,
  gap: spacing.sm,
},

  backButton: {
    width: 42,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchField: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardDarker,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },

  searchInput: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    paddingVertical: 0,
  },

  listContainer: {
    flex: 1,
  },

  listContent: {
    paddingTop: 55,
    paddingBottom: spacing.lg,
  },

  personRow: {
    minHeight: 90,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  groupAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.cardLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },

  personName: {
    flex: 1,
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 17,
  },

  selectionCircle: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(244,241,247,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedCircle: {
    backgroundColor: colors.primaryAccent,
    borderColor: colors.primaryAccent,
  },

  pressed: {
    opacity: 0.75,
  },

  disabledRow: {
    opacity: 0.5,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  loadingText: {
    color: colors.white,
    fontFamily: fontFamily.regular,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  emptyText: {
    color: colors.white,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },

  errorBanner: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(237,28,28,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },

  errorText: {
    flex: 1,
    color: colors.white,
    fontSize: 13,
  },

  retryText: {
    color: colors.linkAccent,
    fontFamily: fontFamily.semibold,
  },

  bottomContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },

  confirmGradient: {
    borderRadius: 24,
    overflow: 'hidden',
  },

  confirmButton: {
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmDisabled: {
    opacity: 0.5,
  },

  confirmText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
});
