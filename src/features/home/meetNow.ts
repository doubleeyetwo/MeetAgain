import { deleteDoc, doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';

import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';

// A MeetNow status lasts two hours. Nothing on the server clears a forgotten
// toggle, so every reader treats a stored status past its expiry as off. That
// keeps expiry a single client-side rule instead of a scheduled job.
export const MEET_NOW_DURATION_MS = 2 * 60 * 60 * 1000;

// One friend's availability as stored, before expiry is applied.
export type MeetNowFriendRow = {
  id: string;
  name: string;
  photoURL: string | null;
  expiresAt: Date | null;
  // Set only on the signed-in user's own tile.
  isSelf?: boolean;
  avatarName?: string;
  // Friends reach this list only while they are free, so this is meaningful
  // on the user's own tile alone.
  available?: boolean;
};

export type MeetNowSelf = {
  id: string;
  photoURL: string | null;
  // Whether this account is currently sharing that it is free.
  available: boolean;
  // Only used for the fallback initial; the tile itself always reads "You".
  displayName?: string;
};

// Duck-typed rather than an instanceof check, because a Date built in a test's
// own realm is not an instanceof the Date the module under test sees.
function asDate(value: unknown): Date | null {
  if (!value || typeof (value as { getTime?: unknown }).getTime !== 'function') {
    return null;
  }
  const time = (value as Date).getTime();
  return typeof time === 'number' && Number.isFinite(time) ? (value as Date) : null;
}

export function meetNowExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + MEET_NOW_DURATION_MS);
}

// The only place the app decides whether a stored status still counts. A status
// that expires exactly now is already over.
export function isMeetNowActive(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const expires = asDate(expiresAt);
  return expires ? expires.getTime() > now.getTime() : false;
}

// Reads the expiry off a freeNow document. An unexpected shape counts as off
// rather than throwing, so one malformed document cannot empty a friend list.
export function readMeetNowExpiry(data: unknown): Date | null {
  if (!data || typeof data !== 'object') return null;
  const value = (data as { expiresAt?: unknown }).expiresAt;

  const stored = asDate(value);
  if (stored) return stored;

  // Firestore hands the field back as a Timestamp.
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return asDate((value as { toDate: () => unknown }).toDate());
  }
  return null;
}

// Friends still marked free, most recently gone free first so the newest
// availability sits at the front of the Home carousel.
export function activeMeetNowFriends(
  rows: MeetNowFriendRow[],
  now: Date = new Date(),
): MeetNowFriendRow[] {
  return rows
    .filter((row) => isMeetNowActive(row.expiresAt, now))
    .sort((first, second) => {
      const gap =
        (second.expiresAt as Date).getTime() - (first.expiresAt as Date).getTime();
      return gap !== 0 ? gap : first.name.localeCompare(second.name);
    });
}

// Watches one account's stored status. Reports the expiry, never a boolean, so
// the caller re-applies expiry as time passes.
export function watchMeetNow(
  uid: string,
  onChange: (expiresAt: Date | null) => void,
  onError: () => void,
): () => void {
  return onSnapshot(
    doc(db, collections.freeNow, uid),
    (snapshot) => {
      onChange(snapshot.exists() ? readMeetNowExpiry(snapshot.data()) : null);
    },
    onError,
  );
}

// Toggling off deletes the document rather than backdating it, so a friend's
// listener sees the status disappear instead of lingering as expired data.
export async function setMeetNow(
  uid: string,
  available: boolean,
  now: Date = new Date(),
): Promise<void> {
  const status = doc(db, collections.freeNow, uid);
  if (!available) {
    await deleteDoc(status);
    return;
  }
  await setDoc(status, { expiresAt: Timestamp.fromDate(meetNowExpiry(now)) });
}

// The signed-in user always leads their own list, free or not, so the switch
// changes something that stays on screen instead of adding and removing a
// tile. A tile that changes in place is easier to notice than one that
// vanishes. Friends still appear only while they are actually free.
export function meetNowList(
  friends: MeetNowFriendRow[],
  self: MeetNowSelf | null,
): MeetNowFriendRow[] {
  if (!self) return friends;
  return [
    // Expiry is already applied before this point, so the tile carries none.
    {
      id: self.id,
      name: 'You',
      avatarName: self.displayName || 'You',
      photoURL: self.photoURL,
      expiresAt: null,
      isSelf: true,
      available: self.available,
    },
    ...friends.filter((friend) => friend.id !== self.id),
  ];
}
