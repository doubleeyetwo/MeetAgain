import { useState, useEffect, useRef } from 'react';
import { Alert, FlatList, Image, Modal, Platform, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, MessagesStackParamList } from '@/navigation/types';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import { MAX_GROUP_MEMBERS, removeGroupMember, watchGroup, type Group } from '@/features/messages/groups';
import { useAuth } from '@/features/auth/AuthContext';
import { PublicProfile } from '@/types/models';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';
import { matchesProfileSearch } from '@/utils/profileSearch';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type Props = NativeStackScreenProps<MessagesStackParamList, 'GroupMembers'>;

// Every member keeps a row, even when their public profile is unavailable.
type GroupMemberRow = {
  uid: string;
  profile: PublicProfile | null;
};

export function GroupMembersScreen({ navigation, route }: Props) {
  // Read the stable ID here; names and membership will come from the live group.
  const { groupId } = route.params;
  const { user } = useAuth();
  // Keep the account ID available so the listener can restart on account changes.
  const uid = user?.uid;
  // null means we do not currently have a group to display.
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  // Keep profile loading separate from loading the group document.
  const [members, setMembers] = useState<GroupMemberRow[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState('');
  // null closes the menu; a UID identifies whose actions should be displayed.
  const [selectedMemberUid, setSelectedMemberUid] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  // State drives the loading indicator and error message.
  const [removing, setRemoving] = useState(false);
  const [removalError, setRemovalError] = useState('');

  // Identify the operation whose progress or error belongs in this menu.
  const [removalContext, setRemovalContext] = useState<{
    actorUid: string;
    groupId: string;
    targetUid: string;
    menuVersion: number;
  } | null>(null);

  // A ref changes immediately, blocking a second submission before React rerenders.
  const removalBusy = useRef(false);
  // Track whether asynchronous callbacks may still update this screen.
  const mounted = useRef(false);

  // Each opening gets a new number, even when reopening the same member.
  const memberMenuVersion = useRef(0);

  // Old callbacks can inspect the latest account, group, and selection.
  const currentContext = useRef({
    uid,
    groupId,
    selectedMemberUid,
    group,
  });
  currentContext.current = { uid, groupId, selectedMemberUid, group };

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      // Invalidate confirmations belonging to the screen that just closed.
      memberMenuVersion.current += 1;
    };
  }, []);

  useEffect(() => {
    // Clear the previous group whenever the group ID or account changes.
    setGroup(null);
    setError('');
    setLoading(true);

    // A signed-out user should not start a Firestore listener.
    if (!uid) {
      setError('Sign in to view group members.');
      setLoading(false);
      return;
    }

    let active = true;

    const unsubscribe = watchGroup(
      groupId,
      (nextGroup) => {
        if (!active) return;

        if (!nextGroup || !nextGroup.memberIds.includes(uid)) {
          setGroup(null);
          setError('This group is unavailable.');
        } else {
          setGroup(nextGroup);
          setError('');
        }

        setLoading(false);
      },
      (subscriptionError) => {
        if (!active) return;

        setGroup(null);
        setError(subscriptionError.message);
        setLoading(false);
      },
    );

    // Stop listening when the screen closes, account changes, or group changes.
    return () => {
      active = false;
      unsubscribe();
    };
  }, [groupId, uid]);

  useEffect(() => {
    let active = true;

    // Clear previous results before loading the current members.
    setMembers([]);
    setProfilesError('');
    setProfilesLoading(false);

    if (!uid || !group || !group.memberIds.includes(uid)) return;

    // Capture this snapshot's IDs before starting asynchronous work.
    const memberIds = [...group.memberIds];
    setProfilesLoading(true);

    async function loadProfiles() {
      const results = await Promise.all(
        memberIds.map(async (memberUid) => {
          try {
            const snapshot = await getDoc(doc(db, collections.publicProfiles, memberUid));

            // Keep a fallback row when the public profile document is missing.
            const profile: PublicProfile | null = snapshot.exists()
              ? ({ ...snapshot.data(), id: snapshot.id } as PublicProfile)
              : null;

            return {
              row: { uid: memberUid, profile },
              failed: false,
            };
          } catch {
            // A failed read keeps its member row instead of rejecting the batch.
            return {
              row: { uid: memberUid, profile: null },
              failed: true,
            };
          }
        }),
      );

      // Discard results if membership/account changed or the screen closed.
      if (!active) return;

      setMembers(results.map((result) => result.row));
      setProfilesError(
        results.some((result) => result.failed)
          ? 'Some member profiles could not be loaded.'
          : '',
      );
      setProfilesLoading(false);
    }

    void loadProfiles();

    // This ignores pending results; it does not cancel Firestore getDoc requests.
    return () => {
      active = false;
    };
  }, [group, groupId, uid]);

  // Keep the source rows intact so clearing search restores all loaded members.
  const filteredMembers = members.filter((member) => matchesProfileSearch(
    query,
    member.profile?.displayName || 'Unavailable Member',
    member.profile?.username || '',
  ));



  function openMemberProfile(memberUid: string) {
    if (!uid) return;

    if (memberUid === uid) {
      // Your own profile still lives in the Profile tab.
      const tabs = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
      tabs?.navigate('Profile', { screen: 'ProfileHome' });
      return;
    }

    // Open inside Messages so goBack() returns to this Members screen.
    navigation.navigate('MemberProfile', { uid: memberUid });
  }

  function openMemberActions(memberUid: string) {
    if (removalBusy.current) return;
    setRemovalError('');
    // Only current members can open actions for another current member.
    if (!uid || !group || !group.memberIds.includes(uid)) return;
    if (!group.memberIds.includes(memberUid)) return;

    // Leaving is separate from kicking, and admins cannot be kicked.
    if (memberUid === uid || group.adminIds.includes(memberUid)) return;

    setConfirmingRemoval(false);
    // Invalidate any confirmation from a previously opened menu.
    memberMenuVersion.current += 1;
    setSelectedMemberUid(memberUid);
  }

  // Look up current profile data instead of storing a copied member row.
  const selectedMember = members.find(
    (member) => member.uid === selectedMemberUid,
  );

  // Recheck eligibility on every render, including live membership changes.
  const canShowMemberActions = Boolean(
    uid &&
    group &&
    selectedMemberUid &&
    group.memberIds.includes(uid) &&
    group.memberIds.includes(selectedMemberUid) &&
    selectedMemberUid !== uid &&
    !group.adminIds.includes(selectedMemberUid),
  );

  // A local pending write may temporarily remove the target from memberIds.
  // Preserve its progress/error without allowing another removal to start.
  const keepRemovalVisible = Boolean(
    selectedMemberUid &&
    removalContext &&
    removalContext.actorUid === uid &&
    removalContext.groupId === groupId &&
    removalContext.targetUid === selectedMemberUid &&
    removalContext.menuVersion === memberMenuVersion.current &&
    group?.id === groupId &&
    uid &&
    group.memberIds.includes(uid) &&
    (removing || removalError !== ''),
  );

  const memberActionsVisible = canShowMemberActions || keepRemovalVisible;

  function closeMemberActions() {
    if (removalBusy.current) return;
    memberMenuVersion.current += 1;
    setSelectedMemberUid(null);
    setConfirmingRemoval(false);
  }

  async function handleRemoveMember(
    targetUid: string,
    expectedActorUid: string,
    expectedGroupId: string,
    expectedMenuVersion: number,
  ) {
    const current = currentContext.current;

    // Reject confirmations belonging to an old screen, account, group, or menu.
    if (!mounted.current || removalBusy.current) return;
    if (current.uid !== expectedActorUid) return;
    if (current.groupId !== expectedGroupId) return;
    if (memberMenuVersion.current !== expectedMenuVersion) return;
    if (current.selectedMemberUid !== targetUid) return;

    // Use the latest loaded membership; the service rechecks it transactionally.
    const latestGroup = current.group;
    if (!latestGroup?.memberIds.includes(expectedActorUid)) return;
    if (!latestGroup.memberIds.includes(targetUid)) return;
    if (targetUid === expectedActorUid || latestGroup.adminIds.includes(targetUid)) return;

    function isCurrentMenu() {
      const latest = currentContext.current;
      return mounted.current
        && latest.uid === expectedActorUid
        && latest.groupId === expectedGroupId
        && latest.selectedMemberUid === targetUid
        && memberMenuVersion.current === expectedMenuVersion;
    }

    // Associate progress and failures with this account, group, and menu session.
    setRemovalContext({
      actorUid: expectedActorUid,
      groupId: expectedGroupId,
      targetUid,
      menuVersion: expectedMenuVersion,
    });

    removalBusy.current = true;
    setRemoving(true);
    setRemovalError('');

    try {
      await removeGroupMember(expectedGroupId, expectedActorUid, targetUid);

      // Don't close a different menu opened while the request was pending.
      if (isCurrentMenu()) {
        removalBusy.current = false;
        closeMemberActions();
      }
    } catch {
      // Keep the current menu open so the user can confirm and retry.
      if (isCurrentMenu()) {
        setRemovalError(
          'Could not remove this member. The group may have changed. Try again.',
        );
      }
    } finally {
      removalBusy.current = false;
      if (mounted.current) setRemoving(false);
    }
  }

  function requestMemberRemoval() {
    if (removalBusy.current || !canShowMemberActions || !selectedMemberUid || !uid) {
      return;
    }

    // Capture exactly what the user is being asked to confirm.
    const targetUid = selectedMemberUid;
    const actorUid = uid;
    const operationGroupId = groupId;
    const menuVersion = memberMenuVersion.current;
    const name = selectedMember?.profile?.displayName || 'this member';
    const message = `Remove ${name} from this group?`;
    let accepted = false;

    function cancelConfirmation() {
      const current = currentContext.current;

      // An old alert must not close a newer menu.
      if (
        mounted.current &&
        current.uid === actorUid &&
        current.groupId === operationGroupId &&
        memberMenuVersion.current === menuVersion
      ) {
        closeMemberActions();
      }
    }

    function confirmRemoval() {
      accepted = true;
      void handleRemoveMember(
        targetUid,
        actorUid,
        operationGroupId,
        menuVersion,
      );
    }

    if (Platform.OS === 'web') {
      if (window.confirm(message)) confirmRemoval();
      else cancelConfirmation();
      return;
    }

    Alert.alert(
      'Kick Member?',
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: cancelConfirmation },
        { text: 'Remove', style: 'destructive', onPress: confirmRemoval },
      ],
      {
        cancelable: true,
        // Dismissing an accepted alert must not invalidate its pending operation.
        onDismiss: () => {
          if (!accepted) cancelConfirmation();
        },
      },
    );
  }

  useEffect(() => {
    // Keep the selection while its operation is pending or showing an error.
    if (!memberActionsVisible) {
      setSelectedMemberUid(null);
      setConfirmingRemoval(false);
    }
  }, [memberActionsVisible]);

  useEffect(() => {
    // A selection belongs only to the account and group where it was opened.
    setSelectedMemberUid(null);
    setConfirmingRemoval(false);
  }, [groupId, uid]);

  const canAddMembers = Boolean(
    group && !removing && group.memberIds.length < MAX_GROUP_MEMBERS,
  );

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.searchBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={25} color={colors.white} />
          </Pressable>
          <View style={styles.searchField}>
            <Ionicons name="search" size={18} color={colors.white} />
            <TextInput
              accessibilityLabel="Search group members"
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
        <Text style={styles.title}>Members</Text>
        <View style={styles.content}>
        {loading ? (
          <Text style={styles.body}>Loading group...</Text>
        ) : error !== '' || group === null ? (
          <View>
            <Text style={styles.body}>
              {error || 'This group is unavailable.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.popToTop()}
            >
              <Text style={styles.body}>Back to messages</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listWrapper}>
            {profilesLoading ? (
              <Text style={styles.body}>Loading member profiles...</Text>
            ) : (
              <View style={styles.listWrapper}>
                {/* A partial failure should not hide successfully loaded members. */}
                {profilesError !== '' && (
                  <Text style={styles.body}>{profilesError}</Text>
                )}

                <FlatList
                  contentContainerStyle={styles.listContent}
                  data={filteredMembers}
                  keyExtractor={(item) => item.uid}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text style={styles.body}>
                      {query.trim() ? 'No members match your search.' : 'No members to display.'}
                    </Text>
                  }
                  ListFooterComponent={(
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !canAddMembers }}
                      disabled={!canAddMembers}
                      onPress={() => navigation.navigate('AddMembers', { groupId })}
                      style={({ pressed }) => [
                        styles.addButton,
                        !canAddMembers && styles.addButtonDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <LinearGradient
                        colors={gradients.purpleAccent}
                        {...gradientDirection.horizontal}
                        style={styles.addGradient}
                      >
                        <Ionicons name="person-add-outline" size={21} color={colors.white} />
                        <Text style={styles.addButtonText}>
                          {group.memberIds.length >= MAX_GROUP_MEMBERS ? 'Group is full' : 'Add New Members'}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  )}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${item.profile?.displayName || 'member'} profile`}
                      onPress={() => openMemberProfile(item.uid)}
                      onLongPress={() => openMemberActions(item.uid)}
                      delayLongPress={500}
                    >
                      {item.profile?.photoDataUrl || item.profile?.photoURL ? (
                        <Image
                          accessibilityLabel={`${item.profile?.displayName || 'Member'} profile photo`}
                          source={{ uri: item.profile.photoDataUrl ?? item.profile.photoURL }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                          {(item.profile?.displayName || 'Unavailable Member').trim() ? (
                            <Text style={styles.avatarInitials}>
                              {(item.profile?.displayName || 'Unavailable Member').trim().slice(0, 1).toUpperCase() || '?'}
                            </Text>
                          ) : (
                            <Ionicons name="person" size={22} color={colors.white} />
                          )}
                        </View>
                      )}
                      <Text numberOfLines={1} style={styles.memberName}>
                        {item.profile?.displayName || 'Unavailable Member'}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={colors.white} />
                    </Pressable>
                  )}
                />
              </View>
            )}
          </View>
        )}
        </View>
      </SafeAreaView>
      <Modal
        transparent
        animationType="fade"
        visible={memberActionsVisible}
        onRequestClose={closeMemberActions}
      >
        <View style={styles.modalContainer}>
          {/* The backdrop closes the menu without handling taps inside its card. */}
          <Pressable
            style={styles.modalBackdrop}
            accessibilityRole="button"
            accessibilityLabel="Close member actions"
            onPress={closeMemberActions}
          />

          <View style={styles.memberMenu} accessibilityViewIsModal>
            <Text style={styles.body}>
              {selectedMember?.profile?.displayName || 'Unavailable Member'}
            </Text>

            {removalError !== '' && (
              <Text style={styles.dangerText} accessibilityRole="alert">
                {removalError}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={removing}
              onPress={requestMemberRemoval}
              style={styles.menuAction}
            >
              <Text style={styles.dangerText}>
                {removing ? 'Removing...' : 'Kick Member'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={removing}
              onPress={closeMemberActions}
              style={styles.menuAction}
            >
              <Text style={styles.body}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  title: { ...text.title, color: colors.white, textAlign: 'center', marginBottom: spacing.sm },
  content: { flex: 1, minHeight: 0, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  listWrapper: { flex: 1, minHeight: 0 },
  // Keep the action after the final member so both remain in one scrollable list.
  listContent: { flexGrow: 1, paddingBottom: spacing.lg },
  body: { ...text.body, color: colors.white },
  memberRow: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: colors.cardLighter, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { ...text.body, color: colors.white, fontSize: 18 },
  memberName: { ...text.body, flex: 1, color: colors.white },
  addButton: { height: 54, borderRadius: 12, overflow: 'hidden', marginTop: spacing.sm },
  addButtonDisabled: { opacity: 0.55 },
  addGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  addButtonText: { ...text.body, color: colors.white },
  pressed: { opacity: 0.75 },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBackdrop: {
    // Stretch the backdrop across its entire parent.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  memberMenu: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  menuAction: { paddingVertical: 12 },
  dangerText: { color: colors.danger },
});
