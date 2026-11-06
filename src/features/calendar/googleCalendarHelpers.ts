export type BusyInterval = { start: string; end: string };

const MAX_BUSY_INTERVALS = 1000;
const MAX_IMPORT_CHUNK_MS = 60 * 24 * 60 * 60 * 1000;

export function buildImportRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 120 * 24 * 60 * 60 * 1000);
  return { start, end };
}

export function buildImportChunks(start: Date, end: Date): Array<{ start: Date; end: Date }> {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new Error('Invalid calendar import range.');
  }
  const chunks: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const chunkEnd = new Date(Math.min(cursor.getTime() + MAX_IMPORT_CHUNK_MS, end.getTime()));
    chunks.push({ start: cursor, end: chunkEnd });
    cursor = chunkEnd;
  }
  return chunks;
}

export function parseBusyIntervals(value: unknown): BusyInterval[] {
  if (!Array.isArray(value)) throw new Error('Google returned an invalid calendar response.');
  const busy = value.map((interval) => {
    if (!interval || typeof interval !== 'object') throw new Error('Google returned an invalid busy interval.');
    const { start, end } = interval as Record<string, unknown>;
    if (typeof start !== 'string' || typeof end !== 'string'
      || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))
      || Date.parse(end) <= Date.parse(start)) {
      throw new Error('Google returned an invalid busy interval.');
    }
    return { start, end };
  });
  if (busy.length > MAX_BUSY_INTERVALS) throw new Error('This calendar has too many busy times to import at once.');
  return busy;
}
