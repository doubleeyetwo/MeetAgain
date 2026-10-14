import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { watchFriendships } from './friendships';

type CountState = { key: string; count: number | null; error: boolean };

// Own totals use the same source as FriendsScreen. Other profiles expose only
// an atomically maintained total, never another person's relationship documents.
export function useFriendCount(profileUid: string | undefined, viewerUid: string | undefined) {
  const key = JSON.stringify([profileUid, viewerUid]);
  const [state, setState] = useState<CountState>({ key: '', count: null, error: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ key, count: null, error: false });
    if (!profileUid || !viewerUid) return;
    const fail = () => {
      if (active) setState({ key, count: null, error: true });
    };
    const update = (count: number) => {
      if (active) setState({ key, count, error: false });
    };
    const unsubscribe = profileUid === viewerUid
      ? watchFriendships(profileUid, (items) => {
        update(items.filter((item) => item.status === 'accepted').length);
      }, fail)
      : onSnapshot(doc(db, 'friendCounts', profileUid), (snapshot) => {
        const count: unknown = snapshot.data()?.count;
        if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) update(count);
        else fail(); // Missing summaries must not masquerade as zero friends.
      }, fail);
    return () => { active = false; unsubscribe(); };
  }, [profileUid, viewerUid, key, attempt]);

  // Do not show a previous identity's count while the new effect is pending.
  const current = state.key === key ? state : { count: null, error: false };
  return {
    label: current.error ? 'Friends unavailable' : current.count === null
      ? 'Loading friends…' : `${current.count} ${current.count === 1 ? 'Friend' : 'Friends'}`,
    error: current.error,
    retry: () => setAttempt((value) => value + 1),
  };
}
