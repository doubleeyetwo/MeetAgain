import type { CalendarSnapshot } from '@/features/calendar/googleCalendar';

export function getDayAvailability(date: Date, calendars: readonly (CalendarSnapshot | null)[]) {
  // Use local time. The exclusive midnight endpoint includes the full 11:59 p.m. minute.
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  let unknown = 0;
  const busyIntervals: { start: number; end: number }[] = [];

  for (const calendar of calendars) {
    // A calendar must cover the entire planning window to count toward availability.
    if (!calendar || calendar.rangeStart.getTime() > start || calendar.rangeEnd.getTime() < end) {
      unknown++;
      continue;
    }

    for (const block of calendar.busy) {
      // Clip the busy block to this day and skip empty intersections.
      const clippedStart = Math.max(start, Date.parse(block.start));
      const clippedEnd = Math.min(end, Date.parse(block.end));
      if (clippedStart < clippedEnd) {
        busyIntervals.push({ start: clippedStart, end: clippedEnd });
      }
    }
  }

  if (unknown === calendars.length) {
    return { freePercentage: null, unknown, shade: null } as const;
  }

  busyIntervals.sort((a, b) => a.start - b.start);
  let busyDuration = 0;
  let coveredUntil = start;
  let longestFreeGap = 0;
  for (const interval of busyIntervals) {
    // A gap before the next busy interval is uninterrupted shared free time.
    longestFreeGap = Math.max(longestFreeGap, interval.start - coveredUntil);
    // Earlier intervals already account for time up to coveredUntil wherever they overlap.
    const newBusyStart = Math.max(interval.start, coveredUntil);
    busyDuration += Math.max(0, interval.end - newBusyStart);
    coveredUntil = Math.max(coveredUntil, interval.end);
  }
  longestFreeGap = Math.max(longestFreeGap, end - coveredUntil);

  const windowDuration = end - start;
  const freePercentage = (windowDuration - busyDuration) / windowDuration * 100;
  const shade = longestFreeGap < 30 * 60_000 ? null
    : freePercentage >= 85 ? 'high'
    : freePercentage >= 60 ? 'medium'
    : freePercentage > 0 ? 'low'
    : null;
  return { freePercentage, unknown, shade } as const;
}
