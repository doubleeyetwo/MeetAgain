import type { GroupMessage } from './messages';
import { MAX_MESSAGE_LENGTH } from './messages';
import { PROFILE_PHOTO_MAX_DATA_URL_LENGTH } from '@/features/auth/profilePhoto';
import {
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function sendDirectMessage(
  conversationId: string,
  senderId: string,
  text: string,
  imageDataUrl?: string,
): Promise<void> {
  // Trim whitespace from the beginning and end of the text.
  const trimmedText = text.trim();
  
  // Photos may have no caption; text-only messages must still contain text.
  if (trimmedText.length === 0 && !imageDataUrl) {
    throw new Error('Write a message before sending.')
  }

  if (trimmedText.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  if (imageDataUrl && (imageDataUrl.length > PROFILE_PHOTO_MAX_DATA_URL_LENGTH || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl))) {
    throw new Error('Choose a smaller JPEG photo.');
  }

  // Reference directConversations/{conversationId}/messages using collection().
  const messagesRef = collection(db, 'directConversations', conversationId, 'messages');

  // Load the friendship record so the client can avoid sending through stale or malformed relationships.
  const friendshipRef = doc(db, 'friendships', conversationId);
  const friendshipsDoc = await getDoc(friendshipRef);
  if (!friendshipsDoc.exists()) {
    throw new Error('You are no longer friends with this user.');
  }

  const friendship = friendshipsDoc.data();
  // Only accepted friendships should allow direct messages.
  if (!friendship || friendship.status !== 'accepted') {
    throw new Error('You are no longer friends with this user.');
  }

  // Guard the stored memberIds value before checking that this sender belongs to the friendship.
  if (!Array.isArray(friendship.memberIds) || !friendship.memberIds.includes(senderId)) {
    throw new Error('You are no longer friends with this user.');
  }

  // Rules repeat the sender and friendship checks when the write commits.
  await addDoc(messagesRef, {
    senderId: senderId,
    text: trimmedText,
    ...(imageDataUrl ? { imageDataUrl } : {}),
    createdAt: serverTimestamp(),
  });
}

export function watchDirectMessages(
  conversationId: string,
  onChange: (messages: GroupMessage[]) => void,
  onError: (error: Error) => void,
): () => void {
  // Read the newest 50 messages to keep the initial download bounded.
  const messagesQuery = query(
    collection(db, 'directConversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );

  // Return the unsubscribe function so the screen can stop listening on exit.
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs.map((messageDoc) => {
        return {
          ...messageDoc.data(),
          id: messageDoc.id,
        } as GroupMessage;
      });

      // The query selects the latest 50 messages, newest first.
      // Reverse our new array so the screen receives them oldest first.
      messages.reverse();

      // Call the function supplied by the screen with the complete message array.
      // The screen can use this callback to replace its messages state.
      onChange(messages);
    },
    onError,
  );
}
