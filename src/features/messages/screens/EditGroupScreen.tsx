import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pickPhotoFromLibrary, takeProfilePhoto } from '@/features/auth/profilePhoto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MessagesStackParamList } from '@/navigation/types';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/theme';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { deleteGroup, leaveGroup, updateGroupSettings, watchGroup, type Group } from '@/features/messages/groups';
import type { ProfilePhoto } from '@/features/auth/AuthContext';

type Props = NativeStackScreenProps<MessagesStackParamList, 'GroupSettings'>;

// This is a screen component, rather than a hook: it renders the Settings route.
export function EditGroupScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const uid = user?.uid;
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  // Keep a newly selected photo local until Save succeeds.
  const [draftPhoto, setDraftPhoto] = useState<ProfilePhoto | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [pickingPhoto, setPickingPhoto] = useState(false);

  // Block repeated picker launches before React renders the disabled button.
  const photoPickBusy = useRef(false);
  const [error, setError] = useState('');
  const [draftName, setDraftName] = useState('');

  // Remember editing without waiting for another render.
  const nameEdited = useRef(false);
  // State controls the button label and visible failure message.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [groupAction, setGroupAction] = useState<'leave' | 'delete' | null>(null);
  const [actionError, setActionError] = useState('');

  // The ref blocks a second submission before React updates the button.
  const saveBusy = useRef(false);

  // Old callbacks can compare their captured values with the current screen.
  const mounted = useRef(false);
  const screenVersion = useRef(0);
  const currentScreen = useRef({ uid, groupId, draftName, draftPhoto, group });
  currentScreen.current = { uid, groupId, draftName, draftPhoto, group };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
      screenVersion.current += 1;
      // Clear the previous group whenever the group ID or account changes.
      setGroup(null);
      setError('');
      setSaveError('');
      setGroupAction(null);
      setActionError('');
      setLoading(true);
      setDraftName('');
      // A photo selected for the previous account or group must not carry over.
      setDraftPhoto(null);
      setPhotoError('');
      nameEdited.current = false;

      // A signed-out user should not start a Firestore listener.
      if (!uid) {
        setError('Sign in to view group settings.');
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
            // Follow live names until the user starts editing this draft.
            if (!nameEdited.current) {
              setDraftName(nextGroup.name);
            }
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

  // Validate the exact trimmed value that will be sent to Firestore.
  const trimmedName = draftName.trim();

  const nameError = trimmedName.length === 0
    ? 'Enter a group name.'
    : trimmedName.length > 80
      ? 'Use 80 characters or fewer.'
      : '';

  const nameChanged = group !== null && trimmedName !== group.name;
  const photoChanged = draftPhoto !== null && draftPhoto.dataUrl !== group?.photoDataUrl;
  const photoUri = draftPhoto?.uri ?? group?.photoDataUrl;

  // Saving also requires current membership and successfully loaded group data.
  const readyToSave = Boolean(
    !loading &&
    error === '' &&
    uid &&
    group?.memberIds.includes(uid) &&
    !group?.deleting &&
    nameError === '' &&
    (nameChanged || photoChanged),
  );

  async function handleSave() {
    if (saveBusy.current || photoPickBusy.current || !readyToSave || !uid) return;

    // Capture what this submission is saving before awaiting Firestore.
    const actorUid = uid;
    const operationGroupId = groupId;
    const submittedName = trimmedName;
    const submittedDraft = draftName;
    const submittedPhoto = draftPhoto;
    const operationVersion = screenVersion.current;

    function isCurrentScreen() {
      const current = currentScreen.current;
      return mounted.current
        && screenVersion.current === operationVersion
        && current.group?.memberIds.includes(actorUid)
        && !current.group?.deleting
        && current.uid === actorUid
        && current.groupId === operationGroupId;
    }

    saveBusy.current = true;
    setSaving(true);
    setSaveError('');

    try {
      // Only send edited fields; a photo-only save should preserve live name changes.
      await updateGroupSettings(operationGroupId, actorUid, {
        ...(nameChanged ? { name: submittedName } : {}),
        ...(photoChanged && submittedPhoto ? { photoDataUrl: submittedPhoto.dataUrl } : {}),
      });

      if (!isCurrentScreen()) return;

      // Don't replace edits made after this request started.
      if (nameChanged && currentScreen.current.draftName === submittedDraft) {
        setDraftName(submittedName);
        nameEdited.current = false;
      }
      if (submittedPhoto && currentScreen.current.draftPhoto === submittedPhoto) {
        // Keep the preview visible while waiting for the saved Firestore snapshot.
        setGroup((previous) => previous ? { ...previous, photoDataUrl: submittedPhoto.dataUrl } : previous);
        setDraftPhoto(null);
      }
    } catch (reason) {
      // Leave the draft intact so a failed save can be retried.
      if (isCurrentScreen()) {
        setSaveError(
          reason instanceof Error
            ? reason.message
            : 'Could not save group settings. Try again.',
        );
      }
    } finally {
      saveBusy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function handlePickPhoto(source: 'library' | 'camera') {
    if (photoPickBusy.current || saveBusy.current || !uid || !group?.memberIds.includes(uid) || group.deleting) return;
    const actorUid = uid;
    const operationGroupId = groupId;
    const operationVersion = screenVersion.current;
    photoPickBusy.current = true;
    setPickingPhoto(true);
    setPhotoError('');

    try {
      const result = await (source === 'camera' ? takeProfilePhoto() : pickPhotoFromLibrary());
      const current = currentScreen.current;
      // Ignore results if the account, group, or membership changed while picking.
      if (!mounted.current || screenVersion.current !== operationVersion
        || current.uid !== actorUid || current.groupId !== operationGroupId
        || !current.group?.memberIds.includes(actorUid) || current.group.deleting) return;
      if (result.error) setPhotoError(result.error);
      if (result.photo) {
        setDraftPhoto(result.photo);
        setSaveError('');
      }
    } catch {
      if (mounted.current && screenVersion.current === operationVersion) {
        setPhotoError('Could not open your photo. Try again.');
      }
    } finally {
      photoPickBusy.current = false;
      if (mounted.current) setPickingPhoto(false);
    }
  }

  function choosePhoto() {
    // Web file pickers must open directly from the user's button press.
    if (Platform.OS === 'web') {
      void handlePickPhoto('library');
      return;
    }
    Alert.alert('Group photo', 'Choose a photo or take a new one.', [
      { text: 'Choose photo', onPress: () => void handlePickPhoto('library') },
      { text: 'Take photo', onPress: () => void handlePickPhoto('camera') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function confirmGroupAction() {
    if (saveBusy.current || photoPickBusy.current || !uid || !group?.memberIds.includes(uid)) return;
    const actorUid = uid;
    const operationGroupId = groupId;
    const operationVersion = screenVersion.current;
    const action = group.createdBy === actorUid ? 'delete' : 'leave';
    if (action === 'leave' && group.deleting) return;

    function isCurrentScreen() {
      const current = currentScreen.current;
      return mounted.current && screenVersion.current === operationVersion
        && current.uid === actorUid && current.groupId === operationGroupId
        && current.group?.memberIds.includes(actorUid)
        && (action === 'delete' ? current.group.createdBy === actorUid
          : current.group.createdBy !== actorUid && !current.group.deleting);
    }

    saveBusy.current = true;
    setGroupAction(action);
    setActionError('');
    const cancel = () => {
      saveBusy.current = false;
      if (isCurrentScreen()) setGroupAction(null);
    };
    const proceed = async () => {
      if (!isCurrentScreen()) { cancel(); return; }
      try {
        if (action === 'delete') await deleteGroup(operationGroupId, actorUid);
        else await leaveGroup(operationGroupId, actorUid);
        // The group listener may already have lost read access; use the captured route identity.
        if (mounted.current && screenVersion.current === operationVersion
          && currentScreen.current.uid === actorUid && currentScreen.current.groupId === operationGroupId) {
          navigation.popToTop();
        }
      } catch (reason) {
        if (isCurrentScreen()) {
          setActionError(reason instanceof Error ? reason.message : `Could not ${action} group. Try again.`);
        }
      } finally {
        saveBusy.current = false;
        if (mounted.current) setGroupAction(null);
      }
    };
    const title = action === 'delete' ? 'Delete Group' : 'Leave Group';
    const message = action === 'delete'
      ? 'Delete this group and all its messages, photos, polls, and linked events for everyone?'
      : 'Leave this group? You will lose access to its conversation.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) void proceed();
      else cancel();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: title, style: 'destructive', onPress: () => void proceed() },
    ], { cancelable: false });
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Group Settings" onBack={() => {
        if (group?.deleting && group.createdBy === uid) navigation.popToTop();
        else navigation.goBack();
      }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading ? (
          <Text style={styles.body}>Loading group settings...</Text>
        ) : error !== '' || group === null ? (
          <View>
            <Text style={styles.body} accessibilityRole="alert">
              {error || 'This group is unavailable.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.popToTop()}
              style={{ paddingVertical: 12 }}
            >
              <Text style={styles.body}>Back to messages</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change group photo"
              accessibilityState={{ disabled: saving || pickingPhoto || groupAction !== null || !!group.deleting, busy: pickingPhoto }}
              disabled={saving || pickingPhoto || groupAction !== null || !!group.deleting}
              onPress={choosePhoto}
              style={styles.photoButton}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatar} accessibilityLabel="Group photo" />
              ) : (
                <View style={styles.avatar}><Ionicons name="people" size={44} color={colors.white} /></View>
              )}
              <View style={styles.cameraBadge}><Ionicons name="camera-outline" size={20} color={colors.white} /></View>
            </Pressable>
            {pickingPhoto && <Text style={styles.photoStatus}>Preparing photo...</Text>}
            {photoError !== '' && <Text style={styles.error} accessibilityRole="alert">{photoError}</Text>}
            <Text style={styles.label}>Edit Group Name</Text>
            <TextInput
              accessibilityLabel="Group name"
              value={draftName}
              editable={!saving && groupAction === null && !group.deleting}
              onChangeText={(value) => {
                setSaveError('');
                // Mark editing immediately so a snapshot cannot overwrite typing.
                nameEdited.current = true;
                setDraftName(value);
              }}
              style={styles.input}
            />
            {nameError !== '' && (
              <Text style={{ color: colors.danger }} accessibilityRole="alert">
                {nameError}
              </Text>
            )}
            {saveError !== '' && (
              <Text style={{ color: colors.danger }} accessibilityRole="alert">
                {saveError}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: !readyToSave || saving || pickingPhoto || groupAction !== null,
                busy: saving,
              }}
              disabled={!readyToSave || saving || pickingPhoto || groupAction !== null}
              onPress={() => void handleSave()}
              style={[styles.saveButton, (!readyToSave || saving || pickingPhoto || groupAction !== null) && styles.disabled]}
            >
              <Text style={styles.body}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
            {group.deleting && group.createdBy === uid && groupAction !== 'delete' && (
              <Text style={styles.body}>Deletion was interrupted. Retry to finish removing this group.</Text>
            )}
            {actionError !== '' && <Text style={styles.error} accessibilityRole="alert">{actionError}</Text>}
            {(!group.deleting || group.createdBy === uid) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={group.createdBy === uid ? 'Delete Group' : 'Leave Group'}
                accessibilityState={{ disabled: groupAction !== null || saving || pickingPhoto, busy: groupAction !== null }}
                disabled={groupAction !== null || saving || pickingPhoto}
                onPress={confirmGroupAction}
                style={[styles.actionRow, (groupAction !== null || saving || pickingPhoto) && styles.disabled]}
              >
                <Ionicons name={group.createdBy === uid ? 'trash-outline' : 'exit-outline'} size={20} color={colors.danger} />
                <Text style={styles.actionText}>
                  {groupAction === 'delete' ? 'Deleting...' : groupAction === 'leave' ? 'Leaving...'
                    : group.createdBy === uid ? (group.deleting ? 'Retry Delete Group' : 'Delete Group') : 'Leave Group'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Follow Figma's centered photo and rounded field with existing theme colors.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  photoButton: { width: 100, height: 100, alignSelf: 'center', marginBottom: 36 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.cardDarker, alignItems: 'center', justifyContent: 'center' },
  cameraBadge: { position: 'absolute', right: -4, bottom: -4, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryAccent, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.white, fontSize: 12, marginBottom: 8 },
  input: { color: colors.white, backgroundColor: colors.cardDarker, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  saveButton: { backgroundColor: colors.primaryAccent, borderRadius: 16, alignItems: 'center', padding: 14, marginTop: 20 },
  disabled: { opacity: 0.5 },
  photoStatus: { color: colors.white, textAlign: 'center', marginBottom: 12 },
  error: { color: colors.danger, marginBottom: 12 },
  body: { color: colors.white },
  actionRow: { marginTop: 32, padding: 16, backgroundColor: colors.cardDarker, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionText: { color: colors.danger, fontSize: 16 },
});
