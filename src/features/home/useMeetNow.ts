import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';
import { useAuth } from '@/features/auth/AuthContext';
import { watchFriendships, type Friendship } from '@/features/friends/friendships';
import {
  activeMeetNowFriends,
  isMeetNowActive,
  meetNowExpiry,
  setMeetNow,
  watchMeetNow,
  type MeetNowFriendRow,
} from '@/features/home/meetNow';
import type { PublicProfile } from '@/types/models';

// Expiry is a clock rule, not a stored flag, so both hooks re-read the time on
// an interval. A status drops off the list on its own without a reload.
const EXPIRY_CHECK_MS = 30 * 1000;

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), EXPIRY_CHECK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// The signed-in account's own MeetNow switch.
export function useMeetNowStatus() {
  const { user } = useAuth();
  const now = useClock();
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');

  // The user's own tile needs their picture, the same one friends see.
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setPhotoURL(null);
      setDisplayName('');
      return;
    }
    let active = true;
    setPhotoURL(null);
    setDisplayName('');
    void getDoc(doc(db, collections.publicProfiles, uid)).then(
      (snapshot) => {
        if (!active || !snapshot.exists()) return;
        const profile = snapshot.data() as PublicProfile;
        setPhotoURL(profile.photoURL ?? profile.photoDataUrl ?? null);
        setDisplayName(profile.displayName ?? '');
      },
      () => {
        // A missing picture only costs the initial fallback, so stay quiet.
      },
    );
    return () => {
      active = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setExpiresAt(null);
      setLoading(false);
      return;
    }
    let active = true;
    setExpiresAt(null);
    setLoading(true);
    setError('');
    const unsubscribe = watchMeetNow(
      uid,
      (next) => {
        if (!active) return;
        setExpiresAt(next);
        setLoading(false);
      },
      () => {
        if (!active) return;
        setLoading(false);
        setError('Could not load your MeetNow status.');
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.uid]);

  async function toggle(next: boolean) {
    const uid = user?.uid;
    if (!uid || saving) return;
    setSaving(true);
    setError('');
    const requestedAt = new Date();
    try {
      await setMeetNow(uid, next, requestedAt);
      // The listener delivers the committed value a moment later. Showing the
      // same expiry that was just written keeps the switch from flipping back
      // while that round trip is in flight.
      setExpiresAt(next ? meetNowExpiry(requestedAt) : null);
    } catch {
      setError(
        next
          ? 'Could not share that you are free. Try again.'
          : 'Could not turn MeetNow off. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    available: isMeetNowActive(expiresAt, now),
    expiresAt,
    photoURL,
    displayName,
    loading,
    saving,
    error,
    toggle,
  };
}

// Accepted friends who are marked free right now. Firestore rules allow a
// friend's status to be fetched by ID but never listed, so this holds one
// listener per friend rather than running a collection query.
export function useMeetNowFriends() {
  const { user } = useAuth();
  const now = useClock();
  const [rows, setRows] = useState<MeetNowFriendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setRows([]);
      setLoading(false);
      setError(false);
      return;
    }
    let active = true;
    setRows([]);
    setLoading(true);
    setError(false);

    const statusListeners = new Map<string, () => void>();
    const expiries = new Map<string, Date | null>();
    const profiles = new Map<string, { name: string; photoURL: string | null }>();
    let friendUids: string[] = [];

    function publish() {
      if (!active) return;
      setRows(
        friendUids.map((friendUid) => ({
          id: friendUid,
          name: profiles.get(friendUid)?.name ?? 'Friend',
          photoURL: profiles.get(friendUid)?.photoURL ?? null,
          expiresAt: expiries.get(friendUid) ?? null,
        })),
      );
    }

    const unsubscribe = watchFriendships(
      uid,
      (friendships: Friendship[]) => {
        if (!active) return;
        friendUids = friendships
          .filter((friendship) => friendship.status === 'accepted')
          .map((friendship) =>
            friendship.memberIds.find((memberId) => memberId !== uid),
          )
          .filter((memberId): memberId is string => typeof memberId === 'string');

        // Stop listening to anyone who is no longer an accepted friend.
        for (const [friendUid, stop] of statusListeners) {
          if (friendUids.includes(friendUid)) continue;
          stop();
          statusListeners.delete(friendUid);
          expiries.delete(friendUid);
        }

        for (const friendUid of friendUids) {
          if (!profiles.has(friendUid)) {
            profiles.set(friendUid, { name: 'Friend', photoURL: null });
            void getDoc(doc(db, collections.publicProfiles, friendUid)).then(
              (snapshot) => {
                if (!active || !snapshot.exists()) return;
                const profile = snapshot.data() as PublicProfile;
                profiles.set(friendUid, {
                  name: profile.displayName || profile.username || 'Friend',
                  photoURL: profile.photoURL ?? profile.photoDataUrl ?? null,
                });
                publish();
              },
              () => {
                if (active) setError(true);
              },
            );
          }
          if (!statusListeners.has(friendUid)) {
            statusListeners.set(
              friendUid,
              watchMeetNow(
                friendUid,
                (next) => {
                  if (!active) return;
                  expiries.set(friendUid, next);
                  publish();
                },
                () => {
                  if (active) setError(true);
                },
              ),
            );
          }
        }

        setLoading(false);
        publish();
      },
      () => {
        if (!active) return;
        setLoading(false);
        setError(true);
      },
    );

    return () => {
      active = false;
      unsubscribe();
      statusListeners.forEach((stop) => stop());
    };
  }, [user?.uid]);

  return { friends: activeMeetNowFriends(rows, now), loading, error };
}
