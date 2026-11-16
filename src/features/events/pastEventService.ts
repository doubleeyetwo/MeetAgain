import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import { db } from '@/config/firebase';
import { collections } from '@/data/firestorePaths';
import { selectPastEvents } from '@/features/events/pastEvents';
import type { MeetEvent } from '@/types/models';

// A photo an attendee is added to a past event's Memories section.
export type Memory = { id: string; uploaderId: string; photoDataUrl: string };

export type Attendee = { id: string; displayName: string; photoUri: string | null };

// Memories live under their event so the event's invite list decides who can see them.
function memoriesRef(eventId: string) {
  return collection(db, collections.events, eventId, collections.memories);
}

/*
 * The profile owner's past events that the viewer may see, most recently ended first.
 * The event rules only let someone list events they were invited to, so the query
 * is by viewer, and selectPastEvents keeps the ones the profile owner attended too.
 * End times are filtered here rather than in the query so no composite index is needed.
 */
export async function fetchPastEvents(profileUid: string, viewerUid: string): Promise<MeetEvent[]> {
  const snapshot = await getDocs(query(
    collection(db, collections.events),
    where('participantIds', 'array-contains', viewerUid),
  ));
  const events = snapshot.docs.map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() }) as MeetEvent);
  return selectPastEvents(events, profileUid, Date.now());
}

export async function fetchEvent(eventId: string): Promise<MeetEvent | null> {
  const snapshot = await getDoc(doc(db, collections.events, eventId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as MeetEvent) : null;
}

export async function fetchAttendees(uids: string[]): Promise<Attendee[]> {
  return Promise.all(uids.map(async (uid) => {
    try {
      const snapshot = await getDoc(doc(db, collections.publicProfiles, uid));
      const profile = snapshot.data();
      return {
        id: uid,
        displayName: typeof profile?.displayName === 'string' ? profile.displayName : 'Attendee',
        photoUri: profile?.photoDataUrl || profile?.photoURL || null,
      };
    } catch {
      // A missing or unreadable profile still keeps its place in the row.
      return { id: uid, displayName: 'Attendee', photoUri: null };
    }
  }));
}

// Newest first, matching the order photos were added.
export async function fetchMemories(eventId: string): Promise<Memory[]> {
  const snapshot = await getDocs(query(memoriesRef(eventId), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((memoryDoc) => ({
    id: memoryDoc.id,
    uploaderId: memoryDoc.data().uploaderId,
    photoDataUrl: memoryDoc.data().photoDataUrl,
  }));
}

// The photo a profile tile shows for this event, if anyone has added one.
export async function fetchLatestMemoryPhoto(eventId: string): Promise<string | null> {
  const snapshot = await getDocs(query(memoriesRef(eventId), orderBy('createdAt', 'desc'), limit(1)));
  return snapshot.docs[0]?.data().photoDataUrl ?? null;
}

// photoDataUrl is a compressed JPEG data URL; the rules cap its size like profile photos.
export async function addMemory(eventId: string, uploaderId: string, photoDataUrl: string): Promise<Memory> {
  const memoryRef = await addDoc(memoriesRef(eventId), {
    uploaderId,
    photoDataUrl,
    createdAt: serverTimestamp(),
  });
  return { id: memoryRef.id, uploaderId, photoDataUrl };
}

// The rules only allow this for the person who posted the photo.
export async function deleteMemory(eventId: string, memoryId: string): Promise<void> {
  await deleteDoc(doc(memoriesRef(eventId), memoryId));
}
