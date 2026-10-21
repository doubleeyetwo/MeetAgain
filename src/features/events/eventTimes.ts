// Date and time rules for the Pick a Time screen.
// This file has no React Native imports so `npm test` can run it under plain Node.
import type { DropdownOption } from '@/components/Dropdown';

export const SLOT_MINUTES = 30;
export const DEFAULT_RANGE_DAYS = 60;
const DEFAULT_DURATION_MINUTES = 60;
const MINUTES_PER_DAY = 24 * 60;

export const END_BEFORE_START_ERROR = 'End must be after the start.';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// The earliest and latest moments a planner may pick, inclusive.
export type SelectableRange = {
  start: Date;
  end: Date;
};

export type EventTimes = {
  start: Date;
  end: Date;
};

const pad = (value: number) => String(value).padStart(2, '0');

// Local calendar day as YYYY-MM-DD; the value behind each date option.
export function toDayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Minutes since local midnight; the value behind each time option.
export function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Minutes of 24 * 60 or more roll over into the next day.
function atMinutes(day: Date, minutes: number) {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minutes / 60),
    minutes % 60
  );
}

function roundUpTo(date: Date, stepMinutes: number) {
  const hasSeconds =
    date.getSeconds() > 0 || date.getMilliseconds() > 0;
  const minutes = minutesOfDay(date) + (hasSeconds ? 1 : 0);

  return atMinutes(
    date,
    Math.ceil(minutes / stepMinutes) * stepMinutes
  );
}

// Starts at the next slot so times that have already passed are never offered.
export function createDefaultRange(
  now = new Date()
): SelectableRange {
  const lastDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + DEFAULT_RANGE_DAYS
  );

  return {
    start: roundUpTo(now, SLOT_MINUTES),
    end: atMinutes(lastDay, MINUTES_PER_DAY - SLOT_MINUTES),
  };
}

// The next full hour, lasting an hour.
export function createDefaultTimes(
  range: SelectableRange
): EventTimes {
  const start = clampToRange(roundUpTo(range.start, 60), range);
  const end = clampToRange(
    new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000),
    range
  );

  return { start, end };
}

export function clampToRange(
  date: Date,
  range: SelectableRange
) {
  if (date.getTime() < range.start.getTime()) {
    return new Date(range.start);
  }

  if (date.getTime() > range.end.getTime()) {
    return new Date(range.end);
  }

  return date;
}

// Every day that has at least one selectable slot.
export function getDateOptions(
  range: SelectableRange
): DropdownOption<string>[] {
  const options: DropdownOption<string>[] = [];
  const day = new Date(
    range.start.getFullYear(),
    range.start.getMonth(),
    range.start.getDate()
  );

  while (day.getTime() <= range.end.getTime()) {
    options.push({
      value: toDayKey(day),
      label: formatDate(day),
    });
    day.setDate(day.getDate() + 1);
  }

  return options;
}

// The slots on one day that fall inside the range.
export function getTimeOptions(
  range: SelectableRange,
  dayKey: string
): DropdownOption<number>[] {
  const day = fromDayKey(dayKey);
  const options: DropdownOption<number>[] = [];

  for (
    let minutes = 0;
    minutes < MINUTES_PER_DAY;
    minutes += SLOT_MINUTES
  ) {
    const time = atMinutes(day, minutes).getTime();

    if (
      time >= range.start.getTime() &&
      time <= range.end.getTime()
    ) {
      options.push({
        value: minutes,
        label: formatMinutes(minutes),
      });
    }
  }

  return options;
}

// Moves to another day and keeps the time, unless that time is outside the range.
export function withDay(
  date: Date,
  dayKey: string,
  range: SelectableRange
) {
  return clampToRange(
    atMinutes(fromDayKey(dayKey), minutesOfDay(date)),
    range
  );
}

export function withTime(
  date: Date,
  minutes: number,
  range: SelectableRange
) {
  return clampToRange(atMinutes(date, minutes), range);
}

// Returns the message to show, or null when the times can be confirmed.
export function validateEventTimes({ start, end }: EventTimes) {
  return end.getTime() <= start.getTime()
    ? END_BEFORE_START_ERROR
    : null;
}

export function formatDate(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const period = hours < 12 ? 'AM' : 'PM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHour}:${pad(minutes % 60)} ${period}`;
}

export function formatTime(date: Date) {
  return formatMinutes(minutesOfDay(date));
}

// "Apr 14, 2026" for a one-day event, otherwise the first and last day.
export function formatEventDate({ start, end }: EventTimes) {
  if (toDayKey(start) === toDayKey(end)) {
    return formatDate(start);
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${formatDate(end)}`;
  }

  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatEventTime({ start, end }: EventTimes) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}
