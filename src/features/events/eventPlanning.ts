import type { EventItem, EventTask } from '../../types/models';

export const MAX_PLANNING_ENTRIES = 20;
export const MAX_ITEM_PRICE = 1_000_000;
export const validItemPrice = (price: unknown): price is number =>
  typeof price === 'number' && Number.isFinite(price) && price >= 0 && price <= MAX_ITEM_PRICE;

export function validTasks(value: unknown): value is EventTask[] {
  return Array.isArray(value) && value.every(entry => entry !== null &&
    typeof entry === 'object' && Number.isSafeInteger(entry.id) &&
    typeof entry.name === 'string' && !!entry.name.trim() && entry.name.length <= 150 &&
    typeof entry.completed === 'boolean' &&
    (entry.assigneeId === null || typeof entry.assigneeId === 'string')) &&
    new Set(value.map(entry => entry.id)).size === value.length;
}

export function validItems(value: unknown): value is EventItem[] {
  return validTasks(value) && value.every(entry => validItemPrice((entry as EventItem).price));
}

export function validatePlanning(items: unknown, tasks: unknown): void {
  if (!validItems(items) || !validTasks(tasks)) throw new Error('Invalid task or item. Names must be 1 to 150 characters and prices must be between $0 and $1,000,000.');
  if (items.length > MAX_PLANNING_ENTRIES || tasks.length > MAX_PLANNING_ENTRIES)
    throw new Error('Events support up to 20 items and 20 tasks.');
}
