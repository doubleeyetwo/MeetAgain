import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';
import { useAuth } from '@/features/auth/AuthContext';
import { pickChatPhotoFromLibrary } from '@/features/auth/profilePhoto';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import { MessagesStackParamList } from '@/navigation/types';
import { PublicProfile } from '@/types/models';
import {
  sendGroupMessage,
  sendGroupPhoto,
  watchGroupMessages,
  type GroupMessage,
} from '../messages';
import { sendGroupPoll } from '../polls';
import { PollCreationModal } from '../PollCreationModal';
import { PollMessageCard } from '../PollMessageCard';
import { sendDirectMessage, watchDirectMessages } from '../directMessages';
import {
  watchDirectFriendship,
} from '@/features/messages/directConversations';


type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversation'>;
type Attachment = { uri: string; dataUrl: string };

export function ConversationScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { kind, title, memberIds } = route.params;
  // Check whether we have a group chat for direct message
  const groupId = route.params.kind === 'group' ? route.params.groupId : undefined;
  const directConversationId = route.params.kind === 'friend' ? route.params.directConversationId : undefined;
  // Find the participant whose UID differs from the signed-in user's
  const otherUid = memberIds.find((uid) => uid !== user?.uid);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [loading, setLoading] = useState(kind === 'group');
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const sendLock = useRef(false);
  const pickLock = useRef(false);
  const active = useRef(true);
  const conversationKey = `${kind}:${groupId ?? directConversationId ?? ''}:${user?.uid ?? ''}`;
  const currentConversation = useRef(conversationKey);
  currentConversation.current = conversationKey;
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    setDraft('');
    setAttachment(null);
    setMenuOpen(false);
    setFullscreenPhoto(null);
    setSendError(null);
  }, [conversationKey]);
  const [friendshipAccepted, setFriendshipAccepted] = useState(false);
  const [friendshipLoading, setFriendshipLoading] = useState(true);
  const [friendshipError, setFriendshipError] = useState<string | null>(null);

  // Block direct-message composition until friendship is confirmed without errors.
  const directComposerDisabled =
    kind === 'friend' &&
    (friendshipLoading || friendshipError !== null || !friendshipAccepted);

  // Also block composition while signed out or while a message write is pending.
  const composerDisabled = !user || sending || directComposerDisabled;
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const canPostToGroup = kind === 'group' && !!groupId;

  useEffect(() => {
    let active = true;
    if (kind !== 'group' || !user) { setLoading(false); setProfiles({}); return; }
    setLoading(true);
    const otherIds = memberIds.filter((uid) => uid !== user.uid);
    void Promise.all(otherIds.map(async (uid) => {
      try {
        const snapshot = await getDoc(doc(db, collections.publicProfiles, uid));
        return snapshot.exists() ? [uid, { id: snapshot.id, ...snapshot.data() } as PublicProfile] as const : null;
      } catch {
        return null;
      }
    })).then((entries) => {
      if (!active) return;
      setProfiles(Object.fromEntries(entries.filter((entry): entry is readonly [string, PublicProfile] => entry !== null)));
      setLoading(false);
    });
    return () => { active = false; };
  }, [kind, memberIds.join('|'), user?.uid]);

  useEffect(() => {
    setMessages([]);
    setMessagesError(null);
    setMessagesLoading(false);

    // Check if user
    if (!user) return;

    // Select the conversation ID and listener based on the route kind.
    let conversationId: string;
    let watchMessages: typeof watchGroupMessages;

    if (kind === 'friend') {
      if (!directConversationId) return;
      conversationId = directConversationId;
      watchMessages = watchDirectMessages;
    } else {
      if (!groupId) return;
      conversationId = groupId;
      watchMessages = watchGroupMessages;
    }

    setMessagesLoading(true);

    let active = true;

    const unsubscribe = watchMessages(
      conversationId,
      (nextMessages) => {
        if (!active) return;
        setMessages(nextMessages);
        setMessagesLoading(false);
      },
      (error) => {
        if (!active) return;

        setMessagesError(error.message);
        setMessagesLoading(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [groupId, directConversationId, kind, user?.uid]);

  useEffect(() => {
    setFriendshipAccepted(false);
    setFriendshipLoading(true);
    setFriendshipError(null);

    if (kind !== 'friend' || !user || !otherUid) {
      setFriendshipLoading(false);
      return;
    }

    let active = true;

    const unsubscribe = watchDirectFriendship(
      user.uid,
      otherUid,
      (accepted) => {
        if (!active) return;
        // Store acceptance and finish loading
        setFriendshipAccepted(accepted);
        setFriendshipLoading(false);
      },
      (error) => {
        if (!active) return;
        setFriendshipAccepted(false);
        setFriendshipError(error.message);
        setFriendshipLoading(false);
      },
    );
    // Stop this listener and ignore late callbacks when the pair changes.
    return () => {
      active = false;
      unsubscribe();
    };
  }, [kind, user?.uid, otherUid]);

  async function handlePickPhoto() {
    if (composerDisabled || pickLock.current || sendLock.current) return;
    pickLock.current = true;
    const startedIn = currentConversation.current;
    setMenuOpen(false);
    setPicking(true);
    setSendError(null);
    try {
      const result = await pickChatPhotoFromLibrary();
      // Do not attach a late picker result to a different conversation.
      if (active.current && currentConversation.current === startedIn) {
        if (result.error) setSendError(result.error);
        else if (result.photo) setAttachment({ uri: result.photo.uri, dataUrl: result.photo.dataUrl });
      }
    } finally {
      pickLock.current = false;
      if (active.current) setPicking(false);
    }
  }

  async function handleSend() {
    // Ignore another send while the current write is pending.
    if (sendLock.current || pickLock.current) return;

    setSendError(null);

    if (!user) {
      setSendError('Sign in before sending a message.');
      return;
    }

    if (directComposerDisabled) {
      setSendError(
        friendshipLoading
          ? 'Checking friendship status...'
          : friendshipError !== null
            ? 'Could not verify friendship. Please reopen the conversation.'
            : 'You must be friends to send messages.',
      );
      return;
    }

    sendLock.current = true;
    const startedIn = currentConversation.current;
    setSending(true);

    try {
      // Select the sending service while sharing draft and error handling.
      if (kind === 'friend') {
        if (!directConversationId) {
          throw new Error('The direct conversation could not be found.');
        }

        await sendDirectMessage(directConversationId, user.uid, draft, attachment?.dataUrl);
      } else {
        if (!groupId) {
          throw new Error('The group could not be found.');
        }

        if (attachment) await sendGroupPhoto(groupId, user.uid, attachment.dataUrl, draft);
        else await sendGroupMessage(groupId, user.uid, draft);
      }

      // Clear the draft only after the write succeeds.
      if (active.current && currentConversation.current === startedIn) {
        setDraft('');
        setAttachment(null);
        setMenuOpen(false);
      }
    }
    catch (error) {
      // Preserve the draft so the user can correct it or retry.
      if (active.current && currentConversation.current === startedIn) setSendError(
        error instanceof Error ? error.message : 'Could not send your message.',
      );
    }
    finally {
      // Restore the input and button after either success or failure.
      sendLock.current = false;
      if (active.current) setSending(false);
    }
  }

  function openPollCreation() {
    setAttachMenuOpen(false);
    setPollOpen(true);
  }

  async function handlePostPoll(question: string, options: string[]) {
    // PollCreationModal shows a thrown error and keeps the entered text.
    if (!user) throw new Error('Sign in before posting a poll.');
    if (!canPostToGroup) throw new Error('Polls are only available in group chats.');
    await sendGroupPoll(groupId!, user.uid, question, options);
  }

  function openPollCreation() {
    setAttachMenuOpen(false);
    setPollOpen(true);
  }

  async function handlePostPoll(question: string, options: string[]) {
    // PollCreationModal shows a thrown error and keeps the entered text.
    if (!user) throw new Error('Sign in before posting a poll.');
    if (!canPostToGroup) throw new Error('Polls are only available in group chats.');
    await sendGroupPoll(groupId!, user.uid, question, options);
  }

  return (
    <LinearGradient colors={gradients.background} {...gradientDirection.vertical} style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back to messages" hitSlop={12} onPress={() => navigation.goBack()} style={styles.side}>
            <Ionicons name="chevron-back" size={25} color={colors.white} />
          </Pressable>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <View style={styles.side} />
        </View>
        {kind === 'group' ? (
          <View style={styles.memberSection}>
            <Text style={styles.sectionTitle}>Members</Text>
            {loading ? <ActivityIndicator color={colors.white} /> : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.members}>
                {memberIds.map((uid) => {
                  const profile = uid === user?.uid ? null : profiles[uid];
                  const displayName = uid === user?.uid ? 'You' : profile?.displayName || 'Unavailable member';
                  const photo = profile?.photoDataUrl || profile?.photoURL;
                  return (
                    <View key={uid} style={styles.member}>
                      {photo ? <Image source={{ uri: photo }} style={styles.memberAvatar} /> : <View style={[styles.memberAvatar, styles.avatarFallback]}><Ionicons name="person" size={20} color={colors.white} /></View>}
                      <Text numberOfLines={1} style={styles.memberName}>{displayName}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        ) : null}
        {/* LOAD MESSAGES HERE */}
        <View style={{ flex: 1 }}>
          {messagesLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : messagesError ? (
            <Text accessibilityRole="alert" style={{ color: '#FFB4AB', padding: 16 }}>
              {messagesError}
            </Text>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {messages.length === 0 ? (
                <Text style={styles.emptyText}>
                  No messages yet. Start the conversation!
                </Text>
              ) : null}

              {messages.map((message) => {
                // Compare identities to decide which side this message belongs on.
                const isOwnMessage = message.senderId === user?.uid;

                if (message.type === 'poll') {
                  return (
                    <View key={message.id} style={{ alignSelf: isOwnMessage ? 'flex-end' : 'flex-start' }}>
                      <PollMessageCard poll={message} />
                    </View>
                  );
                }

                return (
                  <View
                    key={message.id}
                    style={{
                      alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                    }}
                  >
                    <LinearGradient
                      // Use identical colors for received messages to create a solid fill.
                      colors={
                        isOwnMessage
                          ? gradients.purpleAccent
                          : [colors.cardDarker, colors.cardDarker]
                      }
                      {...gradientDirection.horizontal}
                      style={styles.messageBubble}
                    >
                      {message.imageDataUrl ? (
                        <Pressable accessibilityRole="button" accessibilityLabel="View photo full screen" onPress={() => setFullscreenPhoto(message.imageDataUrl!)}>
                          <Image source={{ uri: message.imageDataUrl }} style={styles.messageImage} resizeMode="cover" />
                        </Pressable>
                      ) : null}
                      {message.text ? <Text style={styles.messageText}>{message.text}</Text> : null}
                    </LinearGradient>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
        {sendError !== null ? (
          <Text accessibilityRole="alert" style={{ color: '#FFB4AB', padding: 16 }}>
            {sendError}
          </Text>
        ) : null}
        {attachMenuOpen ? (
          <View style={styles.attachMenu}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a poll"
              onPress={openPollCreation}
              style={styles.attachMenuItem}
            >
              <Text style={styles.attachMenuText}>Create a Poll</Text>
              <Ionicons name="bar-chart-outline" size={20} color={colors.white} />
            </Pressable>
          </View>
        ) : null}
        {menuOpen ? (
          <View style={styles.attachmentMenu}>
            {kind === 'group' ? (
              <View style={[styles.menuRow, styles.menuRowDisabled]} accessibilityState={{ disabled: true }}>
                <Ionicons name="bar-chart-outline" size={22} color={colors.white} />
                <Text style={styles.menuText}>Create a Poll</Text>
                <Text style={styles.menuHint}>Coming soon</Text>
              </View>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Upload photo" onPress={() => { void handlePickPhoto(); }} disabled={composerDisabled || picking} style={styles.menuRow}>
              <Ionicons name="camera-outline" size={22} color={colors.white} />
              <Text style={styles.menuText}>Upload Photo</Text>
            </Pressable>
          </View>
        ) : null}
        {attachment ? (
          <View style={styles.attachmentPreview}>
            <Image source={{ uri: attachment.uri }} style={styles.previewImage} />
            <Text style={styles.previewLabel} numberOfLines={1}>Photo ready to send</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove attachment" onPress={() => setAttachment(null)} disabled={composerDisabled || picking} hitSlop={10}>
              <Ionicons name="close-circle" size={24} color={colors.white} />
            </Pressable>
          </View>
        ) : null}
        {/* Explain direct-message restrictions while keeping history visible. */}
        {kind === 'friend' && directComposerDisabled ? (
          <Text
            accessibilityRole="alert"
            style={friendshipError !== null ? styles.errorText : styles.stateText}
          >
            {friendshipLoading
              ? 'Checking friendship status...'
              : friendshipError !== null
                ? 'Could not verify friendship. Please reopen the conversation.'
                : 'You must be friends to send messages.'}
          </Text>
        ) : null}
        <View style={styles.composer}>
          {canPostToGroup ? (
            <Pressable
              style={styles.attachButton}
              accessibilityRole="button"
              accessibilityLabel={attachMenuOpen ? 'Close message options' : 'Open message options'}
              accessibilityState={{ expanded: attachMenuOpen }}
              onPress={() => setAttachMenuOpen((open) => !open)}
            >
              <Ionicons name={attachMenuOpen ? 'close' : 'add'} size={24} color={colors.white} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={menuOpen ? 'Close attachment menu' : 'Add attachment'} onPress={() => setMenuOpen(!menuOpen)} disabled={composerDisabled || picking} style={styles.addButton}>
            <Ionicons name={menuOpen ? 'close' : 'add'} size={25} color={colors.white} />
          </Pressable>
          <TextInput
            style={styles.messageInput}
            value={draft}
            onChangeText={setDraft}
            onFocus={() => setAttachMenuOpen(false)}
            placeholder="Message..."
            placeholderTextColor="rgba(244,241,247,0.65)"
            accessibilityLabel="Message"
            editable={!composerDisabled && !picking}
          />

          <Pressable
            style={[
              styles.sendButton,
              (composerDisabled || picking || (!draft.trim() && !attachment)) && styles.sendButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={composerDisabled || picking || (!draft.trim() && !attachment)}
            onPress={handleSend}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons name="arrow-up" size={22} color={colors.white} />
            )}
          </Pressable>
        </View>
        <PollCreationModal visible={pollOpen} onClose={() => setPollOpen(false)} onPost={handlePostPoll} />
      </SafeAreaView>
      <Modal visible={fullscreenPhoto !== null} transparent onRequestClose={() => setFullscreenPhoto(null)} animationType="fade">
        <View style={styles.photoModal}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close photo" onPress={() => setFullscreenPhoto(null)} style={styles.closePhoto}>
            <Ionicons name="close" size={30} color={colors.white} />
          </Pressable>
          {fullscreenPhoto ? <Image source={{ uri: fullscreenPhoto }} style={styles.fullscreenImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  side: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { ...text.title, flex: 1, color: colors.white, textAlign: 'center' },
  memberSection: { marginTop: spacing.md, paddingHorizontal: spacing.lg },
  sectionTitle: { ...text.header, color: colors.white, marginBottom: spacing.sm },
  members: { gap: spacing.md, paddingVertical: spacing.sm },
  member: { width: 76, alignItems: 'center', gap: spacing.xs },
  memberAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.cardDarker },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  memberName: { ...text.body, color: colors.white, textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingBottom: 48 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.cardDarker, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...text.body, color: 'rgba(244,241,247,0.8)', fontSize: 16 },
  stateText: { ...text.body, color: colors.white, textAlign: 'center', lineHeight: 21, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  errorText: { ...text.body, color: '#ffb7b7', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, textAlign: 'center' },
  composer: {
    // A row places the input and send button beside each other.
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: 24,
    backgroundColor: colors.cardDarker,
  },
  messageInput: {
    // The input fills the space left over beside the fixed-size button.
    flex: 1,
    ...text.body,
    color: colors.white,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachMenu: {
    // The menu sits just above the plus button, matching the Figma Messages Menu.
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.cardDarker,
  },
  attachMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  attachMenuText: {
    ...text.body,
    color: colors.white,
  },
  messageBubble: {
    // Padding separates the text from the bubble's rounded edges.
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  messageText: {
    ...text.body,
    color: colors.white,
  },
  messageImage: { width: 200, maxWidth: '100%', height: 200, borderRadius: 12, marginBottom: 4 },
  attachmentMenu: { alignSelf: 'flex-start', width: 240, maxWidth: '90%', marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.xs, borderRadius: 18, backgroundColor: colors.cardDarker },
  menuRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  menuRowDisabled: { opacity: 0.55 },
  menuText: { ...text.body, color: colors.white, flex: 1 },
  menuHint: { ...text.body, color: colors.white, fontSize: 12 },
  attachmentPreview: { marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: 14, backgroundColor: colors.cardDarker, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewImage: { width: 42, height: 42, borderRadius: 8 },
  previewLabel: { ...text.body, color: colors.white, flex: 1 },
  addButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  photoModal: { flex: 1, backgroundColor: '#100A1B', justifyContent: 'center' },
  closePhoto: { position: 'absolute', top: 48, right: 20, zIndex: 1, padding: 8 },
  fullscreenImage: { width: '100%', height: '80%' },
});
