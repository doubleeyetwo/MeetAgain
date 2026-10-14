import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Transaction,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export type PublicUser = { uid: string; username: string; displayName: string };
export type Friendship = {
  id: string;
  memberIds: [string, string];
  requesterId: string;
  recipientId: string;
  requesterUsername: string;
  recipientUsername: string;
  status: 'pending' | 'accepted' | 'declined';
};

const usernamePattern = /^[a-z0-9_]{3,20}$/;

// Only exact username documents can be read, so search does not expose the
// private profile collection or permit browsing the entire account directory.
export async function findUserByUsername(input: string): Promise<PublicUser | null> {
  const username = input.trim().toLowerCase();
  if (!usernamePattern.test(username)) {
    throw new Error('Enter a username of 3–20 letters, numbers, or underscores.');
  }
  const claim = await getDoc(doc(db, 'usernames', username));
  if (!claim.exists()) return null;
  const { uid, displayName } = claim.data();
  if (typeof uid !== 'string') return null;
  return { uid, username, displayName: typeof displayName === 'string' ? displayName : username };
}

// Auto-generated Firebase Auth UIDs contain letters and digits. Restricting
// both IDs to that alphabet makes the underscore separator unambiguous.
export function friendshipId(firstUid: string, secondUid: string): string {
  if (!/^[A-Za-z0-9]{1,128}$/.test(firstUid) || !/^[A-Za-z0-9]{1,128}$/.test(secondUid)) {
    throw new Error('This account cannot use friend requests yet.');
  }
  return [firstUid, secondUid].sort().join('_');
}

export async function sendFriendRequest(senderUid: string, recipient: PublicUser): Promise<void> {
  if (senderUid === recipient.uid) throw new Error('You cannot send a request to yourself.');
  const id = friendshipId(senderUid, recipient.uid);
  const relationshipRef = doc(db, 'friendships', id);
  const senderRef = doc(db, 'users', senderUid);
  const recipientClaimRef = doc(db, 'usernames', recipient.username);

  await runTransaction(db, async (transaction) => {
    // Recheck all three records within the transaction. A stale search result
    // cannot create a request to the wrong person or duplicate an existing pair.
    const [existing, sender, recipientClaim] = await Promise.all([
      transaction.get(relationshipRef),
      transaction.get(senderRef),
      transaction.get(recipientClaimRef),
    ]);
    if (existing.exists() && !(
      existing.data().status === 'declined' && existing.data().requesterId === senderUid
    )) {
      throw new Error('A request or friendship already exists with this person.');
    }
    if (!sender.exists() || !recipientClaim.exists() || recipientClaim.data().uid !== recipient.uid) {
      throw new Error('This account is no longer available. Search again.');
    }
    const senderUsername = sender.data().username;
    if (typeof senderUsername !== 'string') throw new Error('Your profile needs a username first.');
    if (existing.exists()) {
      // A declined request can be sent again by its original requester while
      // keeping the same pair document; neither side can create a duplicate.
      transaction.update(relationshipRef, { status: 'pending', updatedAt: serverTimestamp() });
      return;
    }
    transaction.set(relationshipRef, {
      memberIds: [senderUid, recipient.uid].sort(),
      requesterId: senderUid,
      recipientId: recipient.uid,
      requesterUsername: senderUsername,
      recipientUsername: recipient.username,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function respondToFriendRequest(
  friendship: Friendship,
  recipientUid: string,
  response: 'accepted' | 'declined',
): Promise<void> {
  if (friendship.recipientId !== recipientUid || friendship.status !== 'pending') {
    throw new Error('Only the recipient can answer a pending request.');
  }
  await runTransaction(db, async (transaction) => {
    const pairRef = doc(db, 'friendships', friendship.id);
    const snapshot = await transaction.get(pairRef);
    const current = snapshot.data();
    if (!current || current.recipientId !== recipientUid || current.status !== 'pending') {
      throw new Error('This request is no longer pending.');
    }
    if (response === 'accepted') {
      await updateFriendCounts(transaction, { id: snapshot.id, ...current } as Friendship, 1);
    }
    transaction.update(pairRef, { status: response, updatedAt: serverTimestamp() });
  });
}

async function updateFriendCounts(transaction: Transaction, friendship: Friendship, delta: 1 | -1) {
  const refs = friendship.memberIds.map((uid) => doc(db, 'friendCounts', uid));
  const summaries = await Promise.all(refs.map((ref) => transaction.get(ref)));
  const counts = summaries.map((snapshot) => snapshot.data()?.count as unknown);
  if (counts.some((count) => typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count + delta < 0)) {
    throw new Error('Friend counts need to be initialized by the project administrator. Please try again after setup.');
  }
  refs.forEach((ref, index) => transaction.update(ref, {
    count: (counts[index] as number) + delta,
    lastPairId: friendship.id,
  }));
}

export async function removeFriendship(friendship: Friendship, actingUid: string): Promise<void> {
  const relationshipRef = doc(db, 'friendships', friendship.id);
  await runTransaction(db, async (transaction) => {
    // Read the current relationship so a stale profile cannot delete a new pending
    // request. Firestore rules independently enforce accepted status and membership.
    const snapshot = await transaction.get(relationshipRef);
    if (!snapshot.exists()) throw new Error('This friendship no longer exists.');
    const current = snapshot.data();
    if (current.status !== 'accepted' || !Array.isArray(current.memberIds) || !current.memberIds.includes(actingUid)) {
      throw new Error('Only a friend can remove an accepted friendship.');
    }
    await updateFriendCounts(transaction, { id: snapshot.id, ...current } as Friendship, -1);
    transaction.delete(relationshipRef);
  });
}

export function watchFriendships(
  uid: string,
  onChange: (friendships: Friendship[]) => void,
  onError: () => void,
): () => void {
  // The array-contains constraint matches the participant-only list rule.
  const ownPairs = query(collection(db, 'friendships'), where('memberIds', 'array-contains', uid));
  return onSnapshot(ownPairs, (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Friendship)));
  }, onError);
}
