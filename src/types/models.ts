import { Timestamp } from 'firebase/firestore';

// Firestore document shapes shared by the feature screens and data layer.
export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  dateOfBirth?: string;
  // Written by Edit Profile; absent on accounts created before that screen exists.
  bio?: string;
  profileComplete?: boolean;
  photoURL?: string;
  photoDataUrl?: string;
  timezone?: string;
  calendarPrivacy?: 'busy-only' | 'details' | 'none';
  createdAt: Timestamp;
  updatedAt: Timestamp;
};


export type EventItem = {
  id: number;
  name: string;
  price: number;
  completed: boolean;
  assigneeId: string | null;
};

export type EventTask = {
  id: number;
  name: string;
  completed: boolean;
  assigneeId: string | null;
};

export type MeetEvent = {
  id: string;
  creatorId: string;
  title: string;
  description?: string;
  location?: { name: string; address?: string };
  startAt: Timestamp;
  endAt: Timestamp;
  participantIds: string[];
  status: 'draft' | 'polling' | 'confirmed' | 'cancelled';
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Additional event details
  category?: string;
  groupId?: string | null;
  photoURL?: string | null;

  // Planning
  items?: EventItem[];
  tasks?: EventTask[];

  // Invitations and reminders
  rsvps?: Record<string, 'yes' | 'no' | 'pending'>;
  reminderMinutesBefore?: number | null;
};


export type AvailabilityPoll = {
  id: string;
  eventId: string;
  createdBy: string;
  rangeStart: Timestamp;
  rangeEnd: Timestamp;
  participantIds: string[];
  responses: Record<string, string[]>;
  createdAt: Timestamp;
};

export type AppNotification = {
  id: string;
  recipientId: string;
  type: 'event' | 'friend' | 'poll' | 'system';
  title: string;
  body: string;
  readAt?: Timestamp;
  createdAt: Timestamp;
};

// Explicit fields visible to other signed-in users.
// Keep personal account information such as email out of this model.
export type PublicProfile = {
  // This UID must match the publicProfiles document ID.
  id: string;
  displayName: string;
  username: string;
  dateOfBirth?: string;
  bio?: string;
  photoURL?: string;
  photoDataUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

