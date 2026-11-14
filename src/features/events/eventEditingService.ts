import { validatePlanning } from './eventPlanning';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
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
  items?: EventItem[];
  tasks?: EventTask[];
  endAt: { toDate(): Date };
};
// Compare Firestore maps by value rather than property insertion order.
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(obj).sort().filter(key => obj[key] !== undefined).map(key => [key, canonical(obj[key])]));
  }
  return value;
};
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

function selfAssignmentOnly<T extends {id: number; assigneeId: string | null}>(before: T[], after: T[], uid: string): boolean {
  if (before.length !== after.length) return false;
  return before.every((old, index) => {
    const next = after[index];
    if (!next || next.id !== old.id) return false;
    const {assigneeId: oldAssignee, ...oldRest} = old;
    const {assigneeId: nextAssignee, ...newRest} = next;
    if (!same(oldRest, newRest)) return false;
    return oldAssignee === nextAssignee ||
      (oldAssignee == null && nextAssignee === uid) ||
      (oldAssignee === uid && nextAssignee == null);
  });
}

export async function saveEventPlanningDraft(eventId: string, actorId: string, draft: PlanningDraft): Promise<void> {
  if (!eventId || !actorId) throw new Error('Missing event or account.');
  validatePlanning(draft.items, draft.tasks);
  const ref = doc(db, 'events', eventId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This event no longer exists.');
    const event = snap.data() as EditableEvent;
    if (!event.participantIds.includes(actorId)) throw new Error('You are not a participant.');
    if (event.endAt.toDate().getTime() <= Date.now()) throw new Error('Past events cannot be edited.');
    const currentItems = event.items ?? [];
    const currentTasks = event.tasks ?? [];
    if (!same(currentItems, draft.originalItems) || !same(currentTasks, draft.originalTasks)) {
      throw new Error('Someone else updated this event. Reopen it to see the latest changes.');
    }
    let isAdmin = event.creatorId === actorId;
    if (event.groupId) {
      const groupSnap = await tx.get(doc(db, 'groups', event.groupId));
      if (!groupSnap.exists() || groupSnap.data()?.deleting === true) throw new Error('Event group unavailable.');
      isAdmin = Array.isArray(groupSnap.data()?.adminIds) && groupSnap.data()!.adminIds.includes(actorId);
    }
    if (!isAdmin && (!selfAssignmentOnly(currentItems, draft.items, actorId) ||
      !selfAssignmentOnly(currentTasks, draft.tasks, actorId))) {
      throw new Error('You may only assign or unassign yourself.');
    }
    for (const entry of [...draft.items, ...draft.tasks]) {
      if (!entry.name?.trim() || entry.name.length > 150 ||
        (entry.assigneeId != null && !event.participantIds.includes(entry.assigneeId))) {
        throw new Error('Invalid task or item.');
      }
    }
    for (const item of draft.items) {
      if (!Number.isFinite(item.price) || item.price < 0 || item.price > 1000000) {
        throw new Error('Invalid item price.');
      }
    }
    const update: Record<string, unknown> = {};
    if (!same(currentItems, draft.items)) update.items = draft.items;
    if (!same(currentTasks, draft.tasks)) update.tasks = draft.tasks;
    if (Object.keys(update).length === 0) return;

    //debugging test

    console.log('EVENT SAVE DEBUG:', JSON.stringify({
  actorId,
  isAdmin,
  currentItems,
  currentTasks,
  updatedItems: draft.items,
  updatedTasks: draft.tasks,
  update,
}, null, 2));

    tx.update(ref, {...update, updatedAt: serverTimestamp()});
  });
}
