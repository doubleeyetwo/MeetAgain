import { deleteUser, getIdTokenResult, User } from 'firebase/auth';
import { collection, doc, getDocFromServer, getDocsFromServer, query, runTransaction, Transaction, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

const RECENT_SIGN_IN_MS = 4 * 60 * 1000;
const SIGN_IN_AGAIN = 'For security, log out and sign in again, then retry deleting your account.';

type AccountFriendship = { id: string; memberIds: string[]; status: string };

async function removeAccountFriendship(id: string, uid: string): Promise<void> {
  const relationshipRef = doc(db, 'friendships', id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(relationshipRef);
    if (!snapshot.exists()) return;
    const current = snapshot.data();
    if (!Array.isArray(current.memberIds) || !current.memberIds.includes(uid)) {
      throw new Error('This relationship does not belong to your account.');
    }
    if (current.status === 'accepted') {
      await decrementAccountFriendCounts(transaction, { id, ...current } as AccountFriendship);
    } else if (current.status !== 'pending' && current.status !== 'declined') {
      throw new Error('This relationship has an unknown status.');
    }
    transaction.delete(relationshipRef);
  });
}

async function decrementAccountFriendCounts(transaction: Transaction, friendship: AccountFriendship) {
  const refs = friendship.memberIds.map((memberUid) => doc(db, 'friendCounts', memberUid));
  const summaries = await Promise.all(refs.map((ref) => transaction.get(ref)));
  const counts = summaries.map((snapshot) => snapshot.data()?.count as unknown);
  if (counts.some((count) => typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count - 1 < 0)) {
    throw new Error('Friend counts need to be initialized by the project administrator. Please try again after setup.');
  }
  refs.forEach((ref, index) => transaction.update(ref, {
    count: (counts[index] as number) - 1,
    lastPairId: friendship.id,
  }));
}

async function requireRecentSignIn(user: User) {
  if (auth.currentUser?.uid !== user.uid) throw new Error('Your account changed. Sign in and try again.');
  const result = await getIdTokenResult(user);
  const signedInAt = Number(result.claims.auth_time) * 1000;
  if (!Number.isFinite(signedInAt) || Date.now() - signedInAt > RECENT_SIGN_IN_MS) {
    throw new Error(SIGN_IN_AGAIN);
  }
}

async function deleteAuthUser(user: User) {
  if (auth.currentUser?.uid !== user.uid) throw new Error('Your account changed. Sign in and try again.');
  try {
    await deleteUser(user);
  } catch (failure) {
    if (failure && typeof failure === 'object' && 'code' in failure && failure.code === 'auth/requires-recent-login') {
      throw new Error(SIGN_IN_AGAIN);
    }
    throw failure;
  }
}

export async function deleteAccount(user: User): Promise<void> {
  // Firebase Auth requires a recent sign-in for deletion. Check before any data is removed.
  await requireRecentSignIn(user);
  const uid = user.uid;
  const userRef = doc(db, 'users', uid);
  const profile = await getDocFromServer(userRef);
  // The Firestore batch may have succeeded even if Auth deletion failed.
  if (!profile.exists()) {
    await deleteAuthUser(user);
    return;
  }
  const username = profile.data()?.username;
  if (typeof username !== 'string') throw new Error('Your profile could not be found.');

  // Releasing the claim blocks new requests in both directions under the
  // friendship rules. A retry may find it already removed or reassigned.
  const claimRef = doc(db, 'usernames', username);
  await runTransaction(db, async (transaction) => {
    const claim = await transaction.get(claimRef);
    if (claim.exists() && claim.data().uid === uid) transaction.delete(claimRef);
  });

  const pairs = query(collection(db, 'friendships'), where('memberIds', 'array-contains', uid));
  while (true) {
    const relationships = await getDocsFromServer(pairs);
    if (relationships.empty) break;
    for (const relationship of relationships.docs) {
      await removeAccountFriendship(relationship.id, uid);
    }
  }

  // Future Auth/deletion dependency cleanup belongs here, before the final profile/Auth removal.
  // Stop before the final profile removal if the cleanup took too long.
  await requireRecentSignIn(user);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'publicProfiles', uid));
  batch.delete(doc(db, 'friendCounts', uid));
  batch.delete(userRef);
  await batch.commit();
  await deleteAuthUser(user);
}
