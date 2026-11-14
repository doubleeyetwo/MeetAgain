import {
  doc,
  runTransaction,
} from 'firebase/firestore';

import { db } from '@/config/firebase';

export type RSVPStatus = 'yes' | 'no';

export async function updateEventRSVP(
  eventId: string,
  userId: string,
  status: RSVPStatus
): Promise<void> {
  const eventRef = doc(db, 'events', eventId);

  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(eventRef);

    if (!snapshot.exists()) {
      throw new Error('This event no longer exists.');
    }

    const event = snapshot.data();

    if (
      !Array.isArray(event.participantIds) ||
      !event.participantIds.includes(userId)
    ) {
      throw new Error(
        'You are not a participant in this event.'
      );
    }

    transaction.update(eventRef, {
      [`rsvps.${userId}`]: status,
    });
  });
}
