import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';
import { useAuth } from '@/features/auth/AuthContext';
import { colors, gradientDirection, gradients, spacing, text } from '@/theme';
import { MessagesStackParamList } from '@/navigation/types';
import { PublicProfile } from '@/types/models';
import {
  sendGroupMessage,
  watchGroupMessages,
  type GroupMessage,
} from '../messages';
import { sendGroupPoll } from '../polls';
import { PollCreationModal } from '../PollCreationModal';
import { PollMessageCard } from '../PollMessageCard';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversation'>;

export function ConversationScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { kind, title, memberIds, groupId } = route.params;
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [loading, setLoading] = useState(kind === 'group');
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
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

    if (!user || kind !== 'group' || !groupId) return;

    setMessagesLoading(true);

    let active = true;

    const unsubscribe = watchGroupMessages(
      groupId,
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
  }, [groupId, kind, user?.uid]);

  async function handleSend() {
    // Ignore another send while the current write is pending.
    if (sending) return;

    setSendError(null);

    if (!user) {
      setSendError('Sign in before sending a message.');
      return;
    }

    if (kind !== 'group' || !groupId) {
      setSendError('Sending to friends is not available yet.');
      return;
    }

    setSending(true);

    try {
      // Await sendGroupMessage using groupId, user.uid, and draft.
      await sendGroupMessage(groupId, user.uid, draft);

      // Clear the draft only after the write succeeds.
      setDraft('');
    }
    catch (error) {
      // Preserve the draft so the user can correct it or retry.
      setSendError(
        error instanceof Error ? error.message : 'Could not send your message.',
      );
    }
    finally {
      // Restore the input and button after either success or failure.
      setSending(false);
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
                  {kind === 'group'
                    ? 'No messages yet. Start the conversation!'
                    : 'Friend messaging is not available yet.'}
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
                      <Text style={styles.messageText}>
                        {message.text}
                      </Text>
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
        {/* Keep the composer below the message area and error display. */}
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
          <TextInput
            style={styles.messageInput}
            value={draft}
            onChangeText={setDraft}
            onFocus={() => setAttachMenuOpen(false)}
            placeholder="Message..."
            placeholderTextColor="rgba(244,241,247,0.65)"
            accessibilityLabel="Message"
            editable={!sending}
          />

          <Pressable
            style={[
              styles.sendButton,
              (sending || !draft.trim()) && styles.sendButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={sending || !draft.trim()}
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
});
