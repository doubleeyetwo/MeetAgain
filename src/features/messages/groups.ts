import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
  type Transaction,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { friendshipId } from '@/features/friends/friendships';

export const MAX_GROUP_MEMBERS = 10;

export type Group = {
  id: string;
  name: string;
  memberIds: string[];
  createdBy: string;
  adminIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// The separator cannot occur in a Firebase Auth UID accepted by friendshipId.
export function groupMemberKey(memberIds: string[]): string {
  if (memberIds.length < 2 || memberIds.length > MAX_GROUP_MEMBERS) {
    throw new Error(`Choose 1–${MAX_GROUP_MEMBERS - 1} friends for a group.`);
  }
  for (const uid of memberIds) friendshipId(uid, uid);
  const sorted = [...memberIds].sort();
  if (new Set(sorted).size !== sorted.length) throw new Error('Each group member must be selected once.');
  return sorted.join('_');
}

async function findExistingGroup(
  transaction: Transaction,
  membershipRef: DocumentReference,
  key: string,
): Promise<string | null> {
  const membership = await transaction.get(membershipRef);
  if (!membership.exists()) return null;
  const existingId = membership.data().groupId;
  if (typeof existingId !== 'string' || !/^[A-Za-z0-9]{20}$/.test(existingId)) {
    throw new Error('The existing group could not be opened.');
  }
  const existingGroup = await transaction.get(doc(db, 'groups', existingId));
  if (!existingGroup.exists() || existingGroup.data().memberIds?.join('_') !== key) {
    throw new Error('The existing group could not be opened.');
  }
  return existingGroup.id;
}

async function requireAcceptedFriends(
  transaction: Transaction,
  creatorUid: string,
  friendUids: string[],
): Promise<void> {
  const friendRefs = friendUids.map((uid) => doc(db, 'friendships', friendshipId(creatorUid, uid)));
  const friendships = await Promise.all(friendRefs.map((ref) => transaction.get(ref)));
  const allAccepted = friendships.every((friendship, index) => friendship.exists()
    && friendship.data().status === 'accepted'
    && Array.isArray(friendship.data().memberIds)
    && friendship.data().memberIds.join('_') === friendshipId(creatorUid, friendUids[index]));
  if (!allAccepted) {
    throw new Error('Every group member must be an accepted friend. Refresh your friends and try again.');
  }
}

export async function createGroup(creatorUid: string, friendUids: string[]): Promise<Group> {
  const memberIds = [creatorUid, ...friendUids].sort();
  const key = groupMemberKey(memberIds);
  const membershipRef = doc(db, 'groupMemberships', key);
  const counterRef = doc(db, 'groupCounters', creatorUid);
  // Keep this random ID stable across Firestore's automatic transaction retries.
  const newGroupRef = doc(collection(db, 'groups'));

  const groupId = await runTransaction(db, async (transaction) => {
    const existingId = await findExistingGroup(transaction, membershipRef, key);
    if (existingId) {
      return existingId;
    }

    const counter = await transaction.get(counterRef);
    const number = counter.exists() ? counter.data().latestNumber + 1 : 1;
    if (!Number.isSafeInteger(number) || number < 1) throw new Error('The next group name is unavailable.');

    await requireAcceptedFriends(transaction, creatorUid, friendUids);

    const name = `Group${number}`;
    const timestamp = serverTimestamp();
    transaction.set(newGroupRef, {
      name,
      memberIds,
      createdBy: creatorUid,
      adminIds: [creatorUid],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    transaction.set(membershipRef, { groupId: newGroupRef.id, memberIds, createdBy: creatorUid, sequence: number });
    transaction.set(counterRef, { latestNumber: number, lastMemberKey: key });
    return newGroupRef.id;
  });
  const group = await getDoc(doc(db, 'groups', groupId));
  if (!group.exists()) throw new Error('The new group could not be opened.');
  return { id: group.id, ...group.data() } as Group;
}

export function watchGroups(
  uid: string,
  onChange: (groups: Group[]) => void,
  onError: (error: Error) => void,
): () => void {
  const ownGroups = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));
  return onSnapshot(ownGroups, (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Group)));
  }, onError);
}
