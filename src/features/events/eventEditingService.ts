
import {
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

import { db } from '@/config/firebase';
import type { EventItem, EventTask } from '@/types/models';

type PlanningDraft = {
  items: EventItem[];
  tasks: EventTask[];
  originalItems: EventItem[];
  originalTasks: EventTask[];
};

type EditableEvent = {
  creatorId: string;
  participantIds: string[];
  groupId?: string | null;
  title: string;
  category?: string;
  description?: string;
  photoURL?: string | null;
  location?: string | { name: string; address?: string };
  startAt: Timestamp;
  endAt: Timestamp;
  items?: EventItem[];
  tasks?: EventTask[];
};

export type EventDetailsDraft = {
  title?: string;
  category?: string;
  description?: string;
  photoURL?: string | null;
  location?: string | { name: string; address?: string };
  startAt?: Timestamp;
  endAt?: Timestamp;
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (value !== null && typeof value === 'object') {
    if (value instanceof Timestamp) {
      return {
        seconds: value.seconds,
        nanoseconds: value.nanoseconds,
      };
    }

    const obj = value as Record<string, unknown>;

    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .filter((key) => obj[key] !== undefined)
        .map((key) => [key, canonical(obj[key])])
    );
  }

  return value;
};

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

function validParticipantEntryChange<
  T extends {
    id: number;
    completed: boolean;
    assigneeId: string | null;
  }
>(
  before: T[],
  after: T[],
  uid: string
): boolean {
  if (before.length !== after.length) {
    return false;
  }

  return before.every((old, index) => {
    const next = after[index];

    if (!next || next.id !== old.id) {
      return false;
    }

    const {
      assigneeId: oldAssignee,
      completed: oldCompleted,
      ...oldRest
    } = old;

    const {
      assigneeId: nextAssignee,
      completed: nextCompleted,
      ...nextRest
    } = next;

    if (!same(oldRest, nextRest)) {
      return false;
    }

    const validAssignment =
      oldAssignee === nextAssignee ||
      (oldAssignee == null && nextAssignee === uid) ||
      (oldAssignee === uid && nextAssignee == null);

    const validCompletion =
      typeof oldCompleted === 'boolean' &&
      typeof nextCompleted === 'boolean';

    return validAssignment && validCompletion;
  });
}

function validatePlanningEntries(
  items: EventItem[],
  tasks: EventTask[],
  participantIds: string[]
): void {
  if (items.length > 20 || tasks.length > 20) {
    throw new Error(
      'Events support up to 20 items and 20 tasks.'
    );
  }

  for (const entry of [...items, ...tasks]) {
    if (
      !Number.isInteger(entry.id) ||
      !entry.name?.trim() ||
      entry.name.length > 150 ||
      typeof entry.completed !== 'boolean' ||
      (entry.assigneeId != null &&
        !participantIds.includes(entry.assigneeId))
    ) {
      throw new Error('Invalid task or item.');
    }
  }

  for (const item of items) {
    if (
      !Number.isFinite(item.price) ||
      item.price < 0 ||
      item.price > 1000000
    ) {
      throw new Error('Invalid item price.');
    }
  }

  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    new Set(tasks.map((task) => task.id)).size !== tasks.length
  ) {
    throw new Error('Duplicate task or item ID.');
  }
}

function assertEditable(
  event: EditableEvent,
  actorId: string
): void {
  if (!event.participantIds.includes(actorId)) {
    throw new Error('You are not a participant.');
  }

  if (event.endAt.toDate().getTime() <= Date.now()) {
    throw new Error('Past events cannot be edited.');
  }
}

/**
 * Saves changes to the items and tasks of an existing event.
 *
 * Creator:
 * - Add, edit, or remove items and tasks.
 * - Assign items and tasks to any participant.
 * - Check or uncheck items and tasks.
 *
 * Participant:
 * - Assign or unassign themselves.
 * - Check or uncheck items and tasks.
 *
 * Existing conflict detection is preserved.
 */
export async function saveEventPlanningDraft(
  eventId: string,
  actorId: string,
  draft: PlanningDraft
): Promise<void> {
  if (!eventId || !actorId) {
    throw new Error('Missing event or account.');
  }

  const ref = doc(db, 'events', eventId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists()) {
      throw new Error('This event no longer exists.');
    }

    const event = snap.data() as EditableEvent;

    assertEditable(event, actorId);

    const currentItems = event.items ?? [];
    const currentTasks = event.tasks ?? [];

    if (
      !same(currentItems, draft.originalItems) ||
      !same(currentTasks, draft.originalTasks)
    ) {
      throw new Error(
        'Someone else updated this event. Reopen it to see the latest changes.'
      );
    }

    const isCreator = event.creatorId === actorId;

    if (
      !isCreator &&
      (!validParticipantEntryChange(
        currentItems,
        draft.items,
        actorId
      ) ||
        !validParticipantEntryChange(
          currentTasks,
          draft.tasks,
          actorId
        ))
    ) {
      throw new Error(
        'You may only assign or unassign yourself and check or uncheck items and tasks.'
      );
    }

    validatePlanningEntries(
      draft.items,
      draft.tasks,
      event.participantIds
    );

    const update: Record<string, unknown> = {};

    if (!same(currentItems, draft.items)) {
      update.items = draft.items;
    }

    if (!same(currentTasks, draft.tasks)) {
      update.tasks = draft.tasks;
    }

    if (Object.keys(update).length === 0) {
      return;
    }

    tx.update(ref, {
      ...update,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Saves event details.
 *
 * All participants can edit:
 * - Title
 * - Category
 * - Description
 * - Photo
 *
 * Only the creator can edit:
 * - Location
 * - Start time
 * - End time
 *
 * This does not modify invitations, RSVP responses,
 * items, tasks, or event ownership.
 */
export async function saveEventDetails(
  eventId: string,
  actorId: string,
  changes: EventDetailsDraft
): Promise<void> {
  if (!eventId || !actorId) {
    throw new Error('Missing event or account.');
  }

  const allowedKeys = [
    'title',
    'category',
    'description',
    'photoURL',
    'location',
    'startAt',
    'endAt',
  ];

  const requestedKeys = Object.keys(changes);

  if (
    requestedKeys.some(
      (key) => !allowedKeys.includes(key)
    )
  ) {
    throw new Error('Unsupported event detail change.');
  }

  if (requestedKeys.length === 0) {
    return;
  }

  const ref = doc(db, 'events', eventId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists()) {
      throw new Error('This event no longer exists.');
    }

    const event = snap.data() as EditableEvent;

    assertEditable(event, actorId);

    const isCreator = event.creatorId === actorId;

    if (
      !isCreator &&
      requestedKeys.some((key) =>
        ['location', 'startAt', 'endAt'].includes(key)
      )
    ) {
      throw new Error(
        'Only the event creator can edit the date, time, or location.'
      );
    }

    const update: Record<string, unknown> = {};

    for (const key of requestedKeys) {
      const value =
        changes[key as keyof EventDetailsDraft];

      if (value === undefined) {
        continue;
      }

      if (
        !same(
          event[key as keyof EditableEvent],
          value
        )
      ) {
        update[key] = value;
      }
    }

    if (Object.keys(update).length === 0) {
      return;
    }

    if (update.title !== undefined) {
      if (
        typeof update.title !== 'string' ||
        !update.title.trim() ||
        update.title.length > 150
      ) {
        throw new Error('Invalid event title.');
      }
    }

    if (update.category !== undefined) {
      if (
        typeof update.category !== 'string' ||
        update.category.length > 80
      ) {
        throw new Error('Invalid event category.');
      }
    }

    if (update.description !== undefined) {
      if (
        typeof update.description !== 'string' ||
        update.description.length > 2000
      ) {
        throw new Error('Invalid event description.');
      }
    }

    if (update.photoURL !== undefined) {
      if (
        update.photoURL !== null &&
        (typeof update.photoURL !== 'string' ||
          update.photoURL.length > 200023)
      ) {
        throw new Error('Invalid event photo.');
      }
    }

    if (update.location !== undefined) {
      const location = update.location;

      if (
        typeof location !== 'string' &&
        (typeof location !== 'object' ||
          location === null ||
          typeof (
            location as { name?: unknown }
          ).name !== 'string')
      ) {
        throw new Error('Invalid event location.');
      }
    }

    const nextStart = changes.startAt ?? event.startAt;
    const nextEnd = changes.endAt ?? event.endAt;

    if (
      !(nextStart instanceof Timestamp) ||
      !(nextEnd instanceof Timestamp) ||
      nextEnd.toMillis() <= nextStart.toMillis()
    ) {
      throw new Error(
        'The event end time must be after its start time.'
      );
    }

    tx.update(ref, {
      ...update,
      updatedAt: serverTimestamp(),
    });
  });
}
