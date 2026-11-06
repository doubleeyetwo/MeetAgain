import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { buildImportChunks, buildImportRange, BusyInterval, parseBusyIntervals } from '@/features/calendar/googleCalendarHelpers';
import { clearGoogleCalendarToken } from '@/features/calendar/googleCalendarTokenCache';

export { buildImportChunks, buildImportRange, parseBusyIntervals } from '@/features/calendar/googleCalendarHelpers';
export type { BusyInterval } from '@/features/calendar/googleCalendarHelpers';

export type CalendarSnapshot = {
  rangeStart: Date;
  rangeEnd: Date;
  busy: BusyInterval[];
  lastUpdated: Date | null;
};

const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';

export async function importGoogleCalendar(uid: string, accessToken: string, now = new Date()): Promise<void> {
  if (!uid || !accessToken) throw new Error('Sign in to Google Calendar and try again.');
  const { start, end } = buildImportRange(now);
  const busy: BusyInterval[] = [];
  for (const chunk of buildImportChunks(start, end)) {
    const response = await fetch(FREEBUSY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: chunk.start.toISOString(),
        timeMax: chunk.end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        items: [{ id: 'primary' }],
      }),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearGoogleCalendarToken(uid);
        throw new Error('Google access expired or was denied. Import again and grant calendar access.');
      }
      let detail = '';
      try {
        const error = await response.json() as { error?: { message?: unknown } };
        if (typeof error.error?.message === 'string') detail = ` ${error.error.message}`;
      } catch { /* Keep the HTTP status when Google returns no JSON body. */ }
      throw new Error(`Google Calendar could not be imported (HTTP ${response.status}).${detail}`);
    }
    const result = await response.json() as { calendars?: { primary?: { busy?: unknown; errors?: unknown[] } } };
    if (result.calendars?.primary?.errors?.length) throw new Error('Google could not read your primary calendar. Check access and try again.');
    busy.push(...parseBusyIntervals(result.calendars?.primary?.busy));
    if (busy.length > 1000) throw new Error('This calendar has too many busy times to import at once.');
  }
  await setDoc(doc(db, 'calendarImports', uid), {
    rangeStart: Timestamp.fromDate(start),
    rangeEnd: Timestamp.fromDate(end),
    busy,
    lastUpdated: serverTimestamp(),
  });
}

export async function getGoogleCalendarSnapshot(uid: string): Promise<CalendarSnapshot | null> {
  const snapshot = await getDoc(doc(db, 'calendarImports', uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (!(data.rangeStart instanceof Timestamp) || !(data.rangeEnd instanceof Timestamp)) return null;
  let busy: BusyInterval[];
  try {
    busy = parseBusyIntervals(data.busy);
  } catch {
    return null;
  }
  return {
    rangeStart: data.rangeStart.toDate(),
    rangeEnd: data.rangeEnd.toDate(),
    busy,
    lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : null,
  };
}

export async function disconnectGoogleCalendar(uid: string): Promise<void> {
  clearGoogleCalendarToken(uid);
  await deleteDoc(doc(db, 'calendarImports', uid));
}
