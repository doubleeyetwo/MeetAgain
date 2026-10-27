import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { friendshipId } from '@/features/friends/friendships';

/** A durable one-to-one thread keyed by the canonical friendship pair ID. */
export type DirectConversation = {
  id: string;
  memberIds: [string, string];
  createdAt: Timestamp | null;
};

/** Find or create the pair's durable conversation. */
export async function getOrCreateDirectConversation(
  uidA: string,
  uidB: string,
): Promise<DirectConversation> {
  // Reject a self-conversation before constructing any Firestore references.
  if (uidA === uidB) throw new Error('Direct conversations require two different people.');

  // friendshipId validates both UIDs and sorts them, giving both callers the
  // same stable conversation and friendship document IDs.
  const pairId = friendshipId(uidA, uidB);
  const conversationRef = doc(db, 'directConversations', pairId);
  const friendshipRef = doc(db, 'friendships', pairId);

  // Check existing history first. An existing conversation remains usable
  // after the friendship is removed, so do not require friendship in this path.
  const conversationId = await runTransaction<string>(db, async (transaction) => {
    const existing = await transaction.get(conversationRef);
    if (existing.exists()) {
      const data = existing.data();
      // Validate that memberIds is exactly the sorted [uidA, uidB] pair
      const expectedMembers = [uidA, uidB].sort();
      const storedMembers = data.memberIds;

      // Reject malformed data, extra participants, or a different participant pair.
      if (
        !Array.isArray(storedMembers) ||
        storedMembers.length !== 2 ||
        storedMembers[0] !== expectedMembers[0] ||
        storedMembers[1] !== expectedMembers[1]
      ) {
        throw new Error('This conversation has invalid participants. Key didn\'t match the expected friendship pair.');
      }

      // The stored participants match, so reuse the existing conversation.
      return existing.id;
    }

    // For a new conversation, read friendship inside the same transaction.
    const friendship = await transaction.get(friendshipRef);
    if (!friendship.exists()) {
      throw new Error('You are no longer friends with this user.');
    }
    const friendshipData = friendship.data();
    // Compare the friendship's participants against this conversation's expected pair.
    const expectedMembers = [uidA, uidB].sort();
    const storedMembers = friendshipData.memberIds;
    if (
      !friendshipData ||
      friendshipData.status !== 'accepted' ||
      !Array.isArray(storedMembers) ||
      storedMembers.length !== 2 ||
      storedMembers[0] !== expectedMembers[0] ||
      storedMembers[1] !== expectedMembers[1]
    ) {
      throw new Error('You are no longer friends with this user.');
    }

    // Create the record atomically
    transaction.set(conversationRef, {
      memberIds: [uidA, uidB].sort(),
      createdAt: serverTimestamp(),
    });
    return conversationRef.id;
  });

  // Re-read the committed record so the returned createdAt is a Timestamp,
  // not the serverTimestamp sentinel used in the transaction write.
  const conversation = await getDoc(conversationRef);

  // Stop if the record is unexpectedly missing.
  if (!conversation.exists()) {
    throw new Error('The conversation could not be opened.');
  }

  return {
    ...conversation.data(),
    id: conversation.id,
  } as DirectConversation;
}

export function watchDirectConversations(
  uid: string,
  onChange: (conversations: DirectConversation[]) => void,
  onError: (error: Error) => void,
): () => void {
  // Find every conversation containing this user, including past friendships.
  const conversationsQuery = query(
    collection(db, 'directConversations'),
    where('memberIds', 'array-contains', uid),
  );

  // Listen for changes and return the cleanup function for the calling screen.
  return onSnapshot(
    conversationsQuery,
    (snapshot) => {
      // Include each document's ID so the screen can open its conversation.
      const conversations = snapshot.docs.map((conversationDoc) => ({
        ...conversationDoc.data(),
        id: conversationDoc.id,
      } as DirectConversation));
      onChange(conversations);
    },
    onError,
  );
}

/** Observe the canonical pair friendship to determine whether sending is allowed. */
export function watchDirectFriendship(
  uidA: string,
  uidB: string,
  onChange: (accepted: boolean) => void,
  onError: (error: Error) => void,
): () => void {
  // friendshipId sorts the UIDs, so both callers watch the same canonical pair.
  const pairId = friendshipId(uidA, uidB);
  const friendshipRef = doc(db, 'friendships', pairId);

  // Missing, pending, and declined friendships all mean sending is unavailable.
  return onSnapshot(
    friendshipRef,
    (snapshot) => {
      onChange(snapshot.exists() && snapshot.data().status === 'accepted');
    },
    onError,
  );
}
