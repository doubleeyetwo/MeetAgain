import { Timestamp } from 'firebase/firestore';
export type UserProfile = { id: string; displayName: string; email: string; photoURL?: string; timezone?: string; calendarPrivacy?: 'busy-only' | 'details' | 'none'; createdAt: Timestamp; updatedAt: Timestamp; };
export type MeetEvent = { id: string; creatorId: string; title: string; description?: string; location?: { name: string; address?: string }; startAt: Timestamp; endAt: Timestamp; participantIds: string[]; status: 'draft' | 'polling' | 'confirmed' | 'cancelled'; createdAt: Timestamp; updatedAt: Timestamp; };
export type AvailabilityPoll = { id: string; eventId: string; createdBy: string; rangeStart: Timestamp; rangeEnd: Timestamp; participantIds: string[]; responses: Record<string, string[]>; createdAt: Timestamp; };
export type AppNotification = { id: string; recipientId: string; type: 'event' | 'friend' | 'poll' | 'system'; title: string; body: string; readAt?: Timestamp; createdAt: Timestamp; };
