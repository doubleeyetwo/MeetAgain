
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

import { db } from '@/config/firebase';
import type { EventItem, EventTask } from '@/types/models';

type CreateEventInput = {
  creatorId: string;
  title: string;
  category: string;
  description: string;
  startAt: string;
  endAt: string;
  groupId: string | null;
  directConversationId?: string;
  participantIds: string[];
  items: EventItem[];
  tasks: EventTask[];
  reminderMinutesBefore: number | null;
  photoURL: string | null;
  location: string;
};

export async function createEvent(input: CreateEventInput) {
  const eventRef = doc(collection(db, 'events'));

  await setDoc(eventRef, {
    creatorId: input.creatorId,
    // The review screen presents this fallback when the title is blank, so
    // persist the same value accepted by the event rules.
    title: input.title.trim() || 'Untitled Event',
    category: input.category,
    description: input.description,
    startAt: Timestamp.fromDate(new Date(input.startAt)),
    endAt: Timestamp.fromDate(new Date(input.endAt)),
    groupId: input.groupId,
    ...(input.directConversationId ? { directConversationId: input.directConversationId } : {}),
    participantIds: input.participantIds,
    items: input.items,
    tasks: input.tasks,
    reminderMinutesBefore: input.reminderMinutesBefore,
    status: 'confirmed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    photoURL: input.photoURL,
    location: input.location,
  });

  return eventRef.id;
}
