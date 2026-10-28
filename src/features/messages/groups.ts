import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Transaction,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { friendshipId } from '@/features/friends/friendships';
import { MAX_MESSAGE_LENGTH } from './messages';

// The rules check each member's friendship, so keep groups within Firestore's lookup budget.
export const MAX_GROUP_MEMBERS = 10;

export const MAX_GROUP_LENGTH = 80;

// Match the Firestore profile-photo limit, which counts the complete data URL including its prefix.
const MAX_GROUP_PHOTO_DATA_URL_LENGTH = 200_023;
const GROUP_PHOTO_DATA_URL_PATTERN = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

export type Group = {
  photoDataUrl?: string;
  deleting?: boolean;
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
  // Sort a copy so validation and the returned key use a consistent member order.
  const sorted = [...memberIds].sort();
  if (new Set(sorted).size !== sorted.length) throw new Error('Each group member must be selected once.');
  return sorted.join('_');
}

async function requireAcceptedFriends(
  transaction: Transaction,
  creatorUid: string,
  friendUids: string[],
): Promise<void> {
  // Recheck friendship status inside the transaction so stale screen data cannot authorize creation.
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
  // Validate member count, UID format, and duplicate selections before any writes.
  groupMemberKey(memberIds);
  // Number groups per creator so each person's names can advance independently.
  const counterRef = doc(db, 'groupCounters', creatorUid);
  // Keep this random ID stable across Firestore's automatic transaction retries.
  const newGroupRef = doc(collection(db, 'groups'));

  const groupId = await runTransaction(db, async (transaction) => {
    // Read the counter and friendships before writing so group creation and numbering commit together.

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
    // Link this counter increment to the group created in this transaction.
    transaction.set(counterRef, {
      latestNumber: number,
      lastGroupId: newGroupRef.id,
    });
    return newGroupRef.id;
  });
  const group = await getDoc(doc(db, 'groups', groupId));
  if (!group.exists()) throw new Error('The new group could not be opened.');
  return { id: group.id, ...group.data() } as Group;
}

// Update only requested settings while preserving the group's membership and history.
export async function updateGroupSettings(
  groupId: string,
  actorUid: string,
  changes: { name?: string; photoDataUrl?: string },
): Promise<void> {
  const update: { name?: string; photoDataUrl?: string } = {};

  if (changes.name !== undefined) {
    // Validate here too: callers should not depend on the screen's validation.
    const name = changes.name.trim();
    if (name.length === 0) {
      throw new Error('Group must have non-empty name.');
    }
    if (name.length > MAX_GROUP_LENGTH) {
      throw new Error(`Group name must be ${MAX_GROUP_LENGTH} characters or fewer.`);
    }
    update.name = name;
  }

  if (changes.photoDataUrl !== undefined) {
    if (changes.photoDataUrl.length > MAX_GROUP_PHOTO_DATA_URL_LENGTH
      || !GROUP_PHOTO_DATA_URL_PATTERN.test(changes.photoDataUrl)) {
      throw new Error('Group photo must be a JPEG image within the size limit.');
    }
    update.photoDataUrl = changes.photoDataUrl;
  }

  const groupRef = doc(db, 'groups', groupId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(groupRef);

    // Check existence before reading the document's fields.
    if (!snapshot.exists()) {
      throw new Error('This group is unavailable.');
    }

    const group = snapshot.data() as Omit<Group, 'id'>;

    // Any current member may update the group's name and photo.
    if (!group.memberIds.includes(actorUid)) {
      throw new Error('You are not part of this group.');
    }
    if (group.deleting) throw new Error('This group is being deleted.');

    // Include only supplied settings so a photo-only update cannot overwrite the name.
    transaction.update(groupRef, { ...update, updatedAt: serverTimestamp() });
  });
}

// Keep the existing rename API available to current callers.
export async function renameGroup(
  groupId: string,
  actorUid: string,
  draftName: string,
): Promise<void> {
  return updateGroupSettings(groupId, actorUid, { name: draftName });
}

// Add only new accepted friends; re-read capacity and permissions on every retry.
export async function addGroupMembers(
  groupId: string,
  actorUid: string,
  friendUids: string[],
): Promise<void> {
  if (friendUids.length === 0 || new Set(friendUids).size !== friendUids.length) {
    throw new Error('Select each new member once.');
  }
  const groupRef = doc(db, 'groups', groupId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(groupRef);
    if (!snapshot.exists()) throw new Error('This group is unavailable.');
    const group = snapshot.data() as Omit<Group, 'id'>;
    if (!group.memberIds.includes(actorUid)) throw new Error('You are not part of this group.');
    if (group.deleting) throw new Error('This group is being deleted.');
    if (friendUids.some((uid) => group.memberIds.includes(uid))) {
      throw new Error('A selected person is already a member. Refresh and try again.');
    }

    const memberIds = [...group.memberIds, ...friendUids].sort();
    if (memberIds.length > MAX_GROUP_MEMBERS) {
      throw new Error(`Groups can have at most ${MAX_GROUP_MEMBERS} members. Refresh and try again.`);
    }
    // Reuse UID, uniqueness, and maximum-size validation without creating a new group.
    groupMemberKey(memberIds);
    await requireAcceptedFriends(transaction, actorUid, friendUids);
    transaction.update(groupRef, { memberIds, updatedAt: serverTimestamp() });
  });
}

// Remove one non-admin member while preserving the conversation's ID and history.
export async function removeGroupMember(
  groupId: string,
  actorUid: string,
  memberUid: string,
): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);

  await runTransaction(db, async (transaction) => {
    // Read inside the transaction so concurrent changes cause a retry.
    const snapshot = await transaction.get(groupRef);

    if (!snapshot.exists()) {
      throw new Error('This group is unavailable.');
    }

    const group = snapshot.data() as Omit<Group, 'id'>;

    if (!group.memberIds.includes(actorUid)) {
      throw new Error('You are not part of this group.');
    }
    if (group.deleting) throw new Error('This group is being deleted.');

    if (memberUid === actorUid) {
      throw new Error('Cannot kick yourself from group please use the leave function.');
    }

    if (group.adminIds.includes(memberUid)) {
      throw new Error('Cannot kick an admin of the group.');
    }

    if (!group.memberIds.includes(memberUid)) {
      throw new Error('This person is no longer a member of the group.');
    }

    // Keep every UID except the person being removed.
    const nextMemberIds = group.memberIds.filter(
      (uid) => uid !== memberUid,
    );

    // Commit the new membership and timestamp together.
    transaction.update(groupRef, {
      memberIds: nextMemberIds,
      updatedAt: serverTimestamp(),
    });
  });
}

// Leaving changes only the caller's membership. The creator stays to own the group and its history.
export async function leaveGroup(groupId: string, actorUid: string): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(groupRef);
    if (!snapshot.exists()) throw new Error('This group is unavailable.');
    const group = snapshot.data() as Omit<Group, 'id'>;
    if (group.deleting) throw new Error('This group is being deleted.');
    if (!group.memberIds.includes(actorUid)) throw new Error('You are not part of this group.');
    if (group.createdBy === actorUid) throw new Error('The creator can delete the group instead.');
    transaction.update(groupRef, {
      memberIds: group.memberIds.filter((uid) => uid !== actorUid),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteGroup(groupId: string, actorUid: string): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(groupRef);
    if (!snapshot.exists()) throw new Error('This group is unavailable.');
    const group = snapshot.data() as Omit<Group, 'id'>;
    if (group.createdBy !== actorUid || !group.memberIds.includes(actorUid)) {
      throw new Error('Only the group creator can delete this group.');
    }
    // A failed cleanup can be retried without reopening writes to the group.
    if (!group.deleting) transaction.update(groupRef, { deleting: true, updatedAt: serverTimestamp() });
  });

  // Current group data lives in messages and top-level events. Drain bounded batches before
  // removing the parent; Firestore does not cascade subcollection deletes.
  const messagesRef = collection(groupRef, 'messages');
  const eventsRef = collection(db, 'events');
  for (const source of [
    query(messagesRef, limit(200)),
    query(eventsRef, where('groupId', '==', groupId), limit(200)),
  ]) {
    for (;;) {
      const snapshot = await getDocsFromServer(source);
      if (snapshot.empty) break;
      const batch = writeBatch(db);
      snapshot.docs.forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  }
  // Counters and retired membership claims have independent lifetimes and are not group content.
  await deleteDoc(groupRef);
}

// Listen to one group's current data and return Firestore's cleanup function.
export function watchGroup(
  groupId: string,
  onChange: (group: Group | null) => void,
  onError: (error: Error) => void,
): () => void {
  const groupRef = doc(db, 'groups', groupId);
  return onSnapshot(groupRef, (snapshot) => {
    // A readable missing document is different from a listener error, such as
    // permission denial. The screen handles null and errors as unavailable states.
    if (!snapshot.exists()) {
      onChange(null);
      return;
    }

    // The document ID comes from Firestore rather than a stored data field.
    onChange({ ...snapshot.data(), id: snapshot.id } as Group);
  }, onError);
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
