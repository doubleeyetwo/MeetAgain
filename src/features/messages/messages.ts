import {
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  collection,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PROFILE_PHOTO_MAX_DATA_URL_LENGTH } from '@/features/auth/profilePhoto';

export const MAX_MESSAGE_LENGTH = 2000;

export type GroupTextMessage = {
  id: string;
  senderId: string;
  type?: undefined;
  text: string;
  imageDataUrl?: string;

  // A local message can appear before Firestore resolves its server timestamp.
  createdAt: Timestamp | null;
};

// Written by sendGroupPoll in polls.ts.
export type GroupPollMessage = {
  id: string;
  senderId: string;
  type: 'poll';
  question: string;
  options: string[];
  createdAt: Timestamp | null;
};

export type GroupMessage = GroupTextMessage | GroupPollMessage;

export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  text: string,
): Promise<void> {
  // Trim whitespace from the beginning and end of the text.
  const trimmedText = text.trim();

  // Message validation
  if (trimmedText.length === 0) {
    throw new Error('Write a message before sending.')
  }

  if (trimmedText.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  // Reference groups/{groupId}/messages using collection().
  const messagesRef = collection(db, 'groups', groupId, 'messages');

  // Firestore rules will verify that senderId is the authenticated group member.
  await addDoc(messagesRef, {
    senderId: senderId,
    text: trimmedText,
    createdAt: serverTimestamp(),
  });
}

export async function sendGroupPhoto(
  groupId: string,
  senderId: string,
  imageDataUrl: string,
  caption: string,
): Promise<void> {
  const text = caption.trim();
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }
  if (imageDataUrl.length > PROFILE_PHOTO_MAX_DATA_URL_LENGTH || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)) {
    throw new Error('Choose a smaller JPEG photo.');
  }
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    senderId,
    text,
    imageDataUrl,
    createdAt: serverTimestamp(),
  });
}

export function watchGroupMessages(
  groupId: string,
  onChange: (messages: GroupMessage[]) => void,
  onError: (error: Error) => void,
): () => void {
  // Read the newest 50 messages to keep the initial download bounded.
  const messagesQuery = query(
    collection(db, 'groups', groupId, 'messages'),
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
