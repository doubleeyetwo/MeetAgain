import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';
import { useAuth } from '@/features/auth/AuthContext';
import { Friendship, watchFriendships } from '@/features/friends/friendships';
import { PublicProfile } from '@/types/models';

export type MessageFriend = { uid: string; username: string; profile: PublicProfile | null };

export function useAcceptedMessageFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<MessageFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [dataUid, setDataUid] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setFriends([]);
      setDataUid(null);
      setLoading(false);
      setError(false);
      return;
    }
    setFriends([]);
    setDataUid(user.uid);
    setLoading(true);
    setError(false);
    const profileCache = new Map<string, PublicProfile | null>();
    const requests = new Map<string, Promise<PublicProfile | null>>();
    let snapshotGeneration = 0;
    let latestRows: Array<{ uid: string; username: string }> = [];
    const unsubscribe = watchFriendships(user.uid, (relationships: Friendship[]) => {
      if (!active) return;
      const generation = ++snapshotGeneration;
      const accepted = relationships.filter((item) => item.status === 'accepted');
      const rows = accepted.map((friendship) => {
        const uid = friendship.memberIds.find((memberId) => memberId !== user.uid)!;
        return { uid, username: friendship.requesterId === uid ? friendship.requesterUsername : friendship.recipientUsername };
      });
      latestRows = rows;
      setLoading(false);
      setError(false);
      for (const row of rows) {
        if (!profileCache.has(row.uid) && !requests.has(row.uid)) {
          requests.set(row.uid, getDoc(doc(db, collections.publicProfiles, row.uid)).then((snapshot) => (
            snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PublicProfile) : null
          )));
        }
      }
      setFriends(rows.map((row) => ({ ...row, profile: profileCache.get(row.uid) ?? null })));
      const pending = rows.filter((row) => !profileCache.has(row.uid));
      if (pending.length === 0) return;
      void Promise.all(pending.map(async ({ uid }) => {
        const request = requests.get(uid)!;
        try {
          return [uid, await request, false] as const;
        } catch {
          return [uid, null, true] as const;
        } finally {
          if (requests.get(uid) === request) requests.delete(uid);
        }
      })).then((results) => {
        if (!active || generation !== snapshotGeneration) return;
        for (const [uid, profile, failed] of results) {
          if (failed) setError(true);
          else profileCache.set(uid, profile);
        }
        setFriends(latestRows.map((row) => ({ ...row, profile: profileCache.get(row.uid) ?? null })));
      });
    }, () => {
      if (!active) return;
      setLoading(false);
      setError(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.uid, retry]);

  const current = dataUid === (user?.uid ?? null);
  return { friends: current ? friends : [], loading: !current || loading, error: current && error, retry: () => setRetry((value) => value + 1), uid: dataUid };
}
